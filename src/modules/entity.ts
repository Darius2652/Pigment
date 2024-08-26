import fs from 'fs';
import path from 'path';
import pug from 'pug';
import pluralize from 'pluralize';

import a from 'indefinite';

import { ObjectId, Collection } from "mongodb";
import { Router } from "express";

import { Database } from "./mongo";
import { SCOPE } from './utils';
import EventSystem from './event_system';
import EntityQueryBuilder from './entity_query';

interface ComponentModules {
  views: {
    default: boolean,
    context: {[context: string]: string}
  },
  styles: {

  }
}

const DatabaseConnections: {[name: string]: Collection} = {}

interface IPigmentEntityConfig {
  base_class: typeof PigmentEntity
  unique_fields: string[]
  locked_fields: {[field: string]: boolean}
  hidden_fields: string[]
  required_fields: {[field: string]: boolean}
  identifier_field: string | undefined
  identifier_field_ignore_case: boolean
  base_route_override: string | undefined
  linked_fields: {[field: string]: typeof PigmentEntity}
  lookups: {[field: string]: [typeof PigmentEntity, string]}
}

const PigmentEntityConfig: {[name: string]: IPigmentEntityConfig} = {};

export interface IPigmentEntityParams {
  _id?: ObjectId
  date_modified?: Date
}

export default class PigmentEntity extends EventSystem {
  _id?: ObjectId
  date_modified?: Date

  constructor(params: IPigmentEntityParams) {
    super();
    this._id = params._id;
    this.date_modified = params.date_modified;
  }

  private get clean(): {[key: string]: any} {
    let out: any = {...this};

    this.baseClass.config.hidden_fields.forEach((field: string) => {
      delete out[field];
    })
    
    Object.keys(out).forEach(field => {
      if(this.baseClass.config.linked_fields[field]) {
        if(Array.isArray(out[field])) {
          out[field] = out[field].map((instance: PigmentEntity) => instance._id?.toString()).filter((id: any) => !!id);
        } else {
          out[field] = out[field]._id?.toString();
        }
      }
    })

    return out;
  }

  async resolve_links() {
    let fields = Object.keys(this);

    for(let i = 0; i < fields.length; i++) {
      let field = fields[i];

      if(this.baseClass.config.linked_fields[field]) {
        let other_class = this.baseClass.config.linked_fields[field];
        if(Array.isArray((this as any)[field])) {
          (this as any)[field] = (await other_class.find({
            _id: {
              $in: (this as any)[field].map((id: string) => {
                return new ObjectId(id)
              })
            }
          }).exec(false)).filter((i: any) => !!i);
        } else {
          let id: string = (this as any)[field];
          (this as any)[field] = await other_class.findOne({_id: new ObjectId(id)}).exec(false);
        }
      } else if(this.baseClass.config.lookups[field]) {
        let [other_class, other_field] = this.baseClass.config.lookups[field];
        let items = (await other_class.find({
          [other_field]: {
            $in: [
              this._id,
              this._id?.toString()
            ]
          }
        }).exec(false)).filter((i: any) => !!i);

        if(Array.isArray((this as any)[field])) {
          (this as any)[field] = items;
        } else {
          (this as any)[field] = items[0];
        }
      }
    }
  }

  async save(): Promise<string[]> {
    let errors: string[] = [];

    this.trigger_before('save');

    this.date_modified = new Date();

    let out_doc = this.clean;

    if(this.in_database) {
      await this.collection.updateOne({ _id: this._id }, { $set: out_doc });
    } else {
      let t: any = this;
      if(this.baseClass.config.unique_fields.length > 0) {
        let unique_fields = this.baseClass.config.unique_fields;
        let check_fields = unique_fields.map((field: string) => {
          if(this.baseClass.config.identifier_field == field && this.baseClass.config.identifier_field_ignore_case) {
            return {[field]: new RegExp(`^${t[field]}$`, 'i')}
          } else {
            return {[field]: t[field]}
          }
        });
        let existing_items = (await this.collection.find({ $or: check_fields }).toArray());
        if(existing_items.length > 0) {
          for(let i = 0; i < existing_items.length; i++) {
            for(let j = 0; j < unique_fields.length; j++) {
              let item = existing_items[i];
              let field = unique_fields[j];
              if(this.baseClass.config.identifier_field == field && this.baseClass.config.identifier_field_ignore_case) {
                if(item[field].toLowerCase() == t[field].toLowerCase()) errors.push(`${a(this.baseClass.name.toLowerCase(), {capitalize: true})} with that ${field} already exists!`);
              } else {
                if(item[field] == t[field]) errors.push(`${a(this.baseClass.name.toLowerCase(), {capitalize: true})} with that ${field} already exists!`);
              }
            }
          }
          return errors;
        }
      }
      if(this.baseClass.config.required_fields) {
        Object.keys(this.baseClass.config.required_fields).forEach(key => {
          if(!t[key]) errors.push(`Required field ${key} not found`);
        })
      }
      if(errors.length == 0) {
        this._id = ObjectId.createFromTime(this.date_modified.getTime() / 1000);
        await this.collection.insertOne(out_doc);
        this._id = out_doc._id;

        this.trigger('save');
      }
    }

    return errors;
  }

  render_with_context_and_locals(context: string, locals: any = {}) {
    let item_name = pluralize(this.baseClass.name.toLowerCase(), 1).toLowerCase();

    let item_render_context_data = this.modules.views;
    let render_context: string | undefined = undefined;

    if(item_render_context_data.context[context]) {
      render_context = item_render_context_data.context[context];
    } else if(item_render_context_data.default) {
      render_context = item_render_context_data.context.default;
    }

    let mixins_pug_code = fs.readFileSync(path.join(__dirname, '../views', 'mixins.pug'), 'utf-8').toString();
    let generated_mixin_pug_code = fs.readFileSync(path.join(__dirname, '../views', '_mixins_generated.pug'), 'utf-8').toString();

    if(render_context) {
      let file_pug_code = fs.readFileSync(render_context, 'utf-8').toString();

      let scoped_locals = {
        ...locals,
        [item_name]: this
      };

      return pug.render(mixins_pug_code + '\r\n\r\n' + generated_mixin_pug_code + '\r\n\r\n' + file_pug_code, scoped_locals)
    }

    if(process.env.NODE_ENV !== 'production') return 'N/A';

    return '';
  }

  get modules(): ComponentModules {
    let component_root = path.join(SCOPE.__dirname, '/components/entities/', pluralize(this.baseClass.pathName, 1));
    let files = fs.readdirSync(component_root);

    let views = files.filter((f: string) => f.match(/\.pug$/i));

    let default_view = views.find((f: string) => f.match(/^[\w-]+\.pug$/i));

    if(default_view) views = views.filter(v => v !== default_view);
    let context_views: {[context: string]: string} = {};
    for(let i = 0; i < views.length; i++) {
      context_views[views[i].replace(/[\w-]+\.([\w-]+)\.pug/i, '$1')] = path.join(component_root, views[i]);
    }

    if(default_view) context_views.default = path.join(component_root, default_view);

    return {
      styles: {},
      views: {
        default: !!default_view,
        context: context_views
      },
    }
  }

  get identifier(): string | undefined {
    let field: string | undefined = this.baseClass.config.identifier_field;
    let out: string | undefined = undefined;
    let t: any = this;
    if(field) {
      out = t[field];
    } else {
      out = t._id?.toString();
    }
    return out;
  }

  get link() {
    return `/${this.baseClass.base_route}/${this.identifier}`;
  }

  get link_all() {
    return `/${this.baseClass.base_route}/`;
  }

  get link_delete() {
    return `/${this.baseClass.base_route}/${this.identifier}/delete`;
  }

  get in_database() {
    return !!this._id;
  }

  get date_created() {
    return this._id?.getTimestamp();
  }

  get collection(): Collection {
    return this.baseClass.collection;
  }

  static get pathName(): string {
    return pluralize(this.name.toLowerCase(), 2).replace(/\s+/g, '_');
  }

  static get collection(): Collection {
    if(!DatabaseConnections[this.name]) DatabaseConnections[this.name] = Database.collection(this.pathName);

    return DatabaseConnections[this.name];
  }

  static get config() {
    if(!PigmentEntityConfig[this.name]) {
      PigmentEntityConfig[this.name] = {
        base_class: this,
        unique_fields: [],
        locked_fields: {},
        hidden_fields: ['events', 'events_before'],
        required_fields: {},
        identifier_field: undefined,
        identifier_field_ignore_case: false,
        base_route_override: undefined,
        linked_fields: {},
        lookups: {},
      }
    }
    return PigmentEntityConfig[this.name];
  }

  static find(query: {[key: string]: any} = {}) {
    return new EntityQueryBuilder(this.collection, this).find(query);
  }

  static findOne(query: {[key: string]: any} = {}) {
    return new EntityQueryBuilder(this.collection, this).findOne(query);
  }

  static force_unique(...field_names: string[]) {
    this.config.unique_fields.push(...field_names);
  }

  static identifier_field(field: string, ignore_case: boolean) {
    this.config.identifier_field = field;
    this.config.identifier_field_ignore_case = ignore_case;
  }

  static lock_field(field: string) {
    this.config.locked_fields[field] = true;
  }

  static require_field(field: string) {
    this.config.required_fields[field] = true;
  }

  static get isPigmentEntity() {
    return true;
  }

  static query_by_identifier(value: any) {
    let query: any = {};
    if(this.config.identifier_field) {
      if(this.config.identifier_field_ignore_case) {
        query[this.config.identifier_field!] = new RegExp(`^${value.toString()}$`, 'i')
      } else {
        query[this.config.identifier_field!] = value;
      }
    } else {
      query._id = value;
    }
    return query;
  }

  static get base_route() {
    return this.config.base_route_override || this.pathName;
  }

  static link_field(field: string, other_class: typeof PigmentEntity) {
    this.config.linked_fields[field] = other_class;
  }

  static getFromBaseClass(baseClassName: string) {
    return PigmentEntityConfig[baseClassName]?.base_class
  }

  private static REST_ROUTE: Router | undefined;

  static router(base_route?: string) {
    if(this.REST_ROUTE) return this.REST_ROUTE;

    const r = Router();

    if(base_route) {
      base_route = base_route.replace(/^\/+/g, '').replace(/\/+$/, '')
      this.config.base_route_override = base_route;
    }

    r.get(`/${this.base_route}/`, async (req, res) => {
      res.locals[this.pathName] = await this.find({}).exec();
      return res.render(`${this.pathName}/list`)
    })

    r.post(`/${this.base_route}/`, async (req, res, next) => {
      let params: any = req.body;
      try {
        let item = new this(params);
        let errors = await item.save();
        if(errors.length) {
          return res.status(400).json({messages: errors});
        } else {
          return res.json({});
        }
      } catch(e) {
        return res.status(400).json({});
      }
    })

    r.get(`/${this.base_route}/:identifier`, async (req, res, next) => {
      let item = await this.findOne(this.query_by_identifier(req.params.identifier)).exec();
      if(!item) return next();
      res.locals[pluralize(this.pathName, 1)] = item;
      return res.render(`${this.pathName}/view`);
    })

    r.put(`/${this.base_route}/:identifier`, async (req, res, next) => {
      let item: any = await this.findOne(this.query_by_identifier(req.params.identifier)).exec();

      if(!item) return res.status(400).json({messages: [`${req.params.identifier} not found`]});

      let body: any = req.body;

      let changes = false;

      let body_keys = Object.keys(body);

      for(let i = 0; i < body_keys.length; i++) {
        let key = body_keys[i];

        if(!item.hasOwnProperty(key)) return res.status(400).json({messages: [`Invalid parameters provided`]});
        if(this.config.hidden_fields.includes(key)) return res.status(400).json({messages: [`Invalid parameters provided`]});
        if(this.config.locked_fields[key]) return res.status(400).json({messages: [`Invalid parameters provided`]});
  
        item[key] = body[key];
        changes = true;
      }

      if(changes) await item.save();

      return res.json({});
    })

    r.delete(`/${this.base_route}/:identifier`, async (req, res, next) => {
      let item: any = await this.findOne(this.query_by_identifier(req.params.identifier)).exec();
      if(!item) return res.status(400).json({messages: [`${req.params.identifier} not found`]});

      await this.collection.deleteOne({_id: item._id});

      return res.json({});
    })

    this.REST_ROUTE = r;

    return r;
  }

  private static ENABLE_REST(base_route: string = this.pathName) {
    const r = Router();

    base_route = base_route.replace(/^\/+/g, '').replace(/\/+$/, '')
    
    base_route = `api/${base_route}`;

    r.get(`/${base_route}/`, async (req, res) => {
      let items: any = await this.find({}).exec();
      return res.json(items.map((item: any) => item.clean));
    })

    r.post(`/${base_route}/`, async (req, res, next) => {
      let params: any = req.body;
      try {
        let item = new this(params);
        let errors = await item.save();
        if(errors.length) {
          return res.status(400).json({messages: errors});
        } else {
          return res.json(item.clean);
        }
      } catch(e) {
        return res.status(400).json({messages: ['Invalid request']});
      }
    })

    r.get(`/${base_route}/:identifier`, async (req, res, next) => {
      let item: any = await this.findOne(this.query_by_identifier(req.params.identifier)).exec();
      if(!item) return res.status(400).json({messages: ['Invalid request']});
      return res.json(item.clean);
    })

    r.put(`/${base_route}/:identifier`, async (req, res, next) => {
      let item: any = await this.findOne(this.query_by_identifier(req.params.identifier)).exec();

      if(!item) return res.status(400).json({messages: ['Invalid request']});

      let body: any = req.body;

      let changes = false;

      let body_keys = Object.keys(body);

      for(let i = 0; i < body_keys.length; i++) {
        let key = body_keys[i];

        if(!item.hasOwnProperty(key)) return res.status(400).json({messages: [`Invalid request`]});
        if(this.config.hidden_fields.includes(key)) return res.status(400).json({messages: [`Invalid request`]});
        if(this.config.locked_fields[key]) return res.status(400).json({messages: [`Invalid request`]});
  
        if(this.config.linked_fields[key]) {
          let other_class = this.config.linked_fields[key];
          if(Array.isArray(body[key])) {
            item[key] = await other_class.find({ _id: {$in: body[key].map((id: string) => {return new ObjectId(id)}) }}).exec();
          } else {
            let id: string = body[key];
            item[key] = await other_class.findOne({ _id: new ObjectId(id) }).exec();
          }
        } else {
          item[key] = body[key];
        }

        changes = true;
      }

      if(changes) await item.save();

      return res.send();
    })

    r.delete(`/${base_route}/:identifier`, async (req, res, next) => {
      let item: any = await this.findOne(this.query_by_identifier(req.params.identifier)).exec();
      if(!item) return res.status(400).json({messages: [`Invalid request`]});

      await this.collection.deleteOne({_id: item._id});

      return res.send();
    })

    setTimeout(function() {
      SCOPE.app?.use(r);
    }, 100)
  }
}
