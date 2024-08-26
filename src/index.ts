require('dotenv').config();

import express, { Router } from "express";
import { createServer, Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";

import session from "express-session";
import MongoStore from "connect-mongo";

import bodyParser from 'body-parser';

import PigmentEntity from "./modules/entity";
import { IPigmentEntityParams } from "./modules/entity";

import PigmentSassMiddleware from "./modules/pigment_sass_middleware";

import { SCOPE } from "./modules/utils";
import path from 'path';
import fs from 'fs';
import { ObjectId } from "mongodb";
import pluralize from "pluralize";
import UIComponentManager from "./modules/ui_component_manager";
import { MongoClient } from "./modules/mongo";

interface PigmentParams {
  __dirname: string
  name?: string
  port?: number
  component_root?: string
}

declare module 'express-session' {
  interface SessionData {
    [key: string]: any
  }
}

const SESSION_ENTITIES: {[session_id: string]: {
  date_updated: Date,
  data: {
    [key: string]: PigmentEntity
  }
}} = {};

const PigmentEntitySessionRegex = /^\[PigmentEntity::(\w+)<(\w+)>\]$/;

class PigmentClass {
  name: string
  app: express.Application
  httpServer: HTTPServer
  io: SocketIOServer
  port: number
  store: MongoStore

  constructor(params: PigmentParams) {
    SCOPE.__dirname = params.__dirname;
    this.name = params.name || process.env.NAME || "Pigment App";

    this.app = express();
    this.httpServer = createServer(this.app);
    this.io = new SocketIOServer(this.httpServer, {  });

    this.store = new MongoStore({
      client: MongoClient,
      dbName: process.env.MONGO_DATABASE_NAME,
      collectionName: '_sessions',
      serialize: (session) => {
        let keys = Object.keys(session);
        for(let i = 0; i < keys.length; i++) {
          let key = keys[i];
          if(key == 'cookie') continue;

          if(session[key] instanceof PigmentEntity) {
            if(!SESSION_ENTITIES[session.id]) SESSION_ENTITIES[session.id] = {
              date_updated: new Date(),
              data: {}
            };

            SESSION_ENTITIES[session.id].data[key] = session[key];

            session[key] = `[PigmentEntity::${session[key].baseClass.name}<${session[key]._id}>]`;
          }
        }

        return session;
      }
    });
    
    this.store.on('error', function(error) {
      console.log(error);
    });

    this.port = params.port || parseInt(process.env.PORT || "") || 8000;

    SCOPE.COMPONENT_ROOT = params.component_root;

    SCOPE.app = this.app;

    this.setup_app();
  }

  setup_app() {
    this.app.set('view engine', 'pug');
    this.app.locals.APP_NAME = this.name;
    this.app.locals.basedir = path.join(path.join(__dirname, 'views'));
    this.app.locals.pluralize = pluralize;

    this.app.use(session({
      secret: process.env.SESSION_SECRET || "",
      cookie: {
        maxAge: parseInt(process.env.SESSION_MAX_AGE || "") || 1000 * 60 * 60 * 24 * 7 // 1 week
      },
      store: this.store,
      resave: true,
      saveUninitialized: true,
    }));

    this.app.use(bodyParser.urlencoded({extended: true}))
    this.app.use(bodyParser.json())

    this.app.use((req, res, next) => {
      res.header('x-powered-by', 'Pigment');
      UIComponentManager.generate();
      next();
    })

    let shared_scripts_path = path.join(SCOPE.__dirname, '/components/shared/scripts');
    if(fs.existsSync(shared_scripts_path)) {
      this.app.use('/js/', express.static(shared_scripts_path));
    }

    let public_path = path.join(SCOPE.__dirname, '/public');
    if(fs.existsSync(public_path)) {
      this.app.use(express.static(public_path));
    }

    this.app.use(express.static(path.join(__dirname, 'public')));

    this.app.use(PigmentSassMiddleware);

    this.app.use(async (req, res, next) => {
      let session = req.session;

      let keys = Object.keys(session);

      for(let i = 0; i < keys.length; i++) {
        let key = keys[i];
        if(key == 'cookie') continue;

        if(SESSION_ENTITIES[session.id] && SESSION_ENTITIES[session.id].data[key]) {
          session[key] = SESSION_ENTITIES[session.id].data[key];
          continue;
        }

        if(typeof session[key] == 'string' && session[key].match(PigmentEntitySessionRegex)) {
          let _: string;
          let baseClassName: string;
          let entityID: string;
          [_, baseClassName, entityID] = session[key].match(/^\[PigmentEntity::(\w+)<(\w+)>\]$/) as any;

          let baseClass = PigmentEntity.getFromBaseClass(baseClassName);
          if(!baseClass) continue;
          let entity = await baseClass.findOne({ _id: new ObjectId(entityID) }).exec();
          if(entity) session[key] = entity;
        }
      }

      return next();
    })

    setTimeout(() => {
      this.app.get('/', (req, res) => {
        let index_path = path.join(SCOPE.__dirname, '/views', 'index.pug');
        if(fs.existsSync(index_path)) {
          return res.render('index');
        } else {
          return res.render(path.join(__dirname, 'views/default'));
        }
      })
    }, 250);
  }

  use(...expressUseParams: any) {
    return this.app.use.apply(this.app, expressUseParams);
  }

  get(...expressGetParams: any) {
    return this.app.get.apply(this.app, expressGetParams);
  }

  post(...expressPostParams: any) {
    return this.app.post.apply(this.app, expressPostParams);
  }

  listen() {
    this.httpServer.listen(this.port, () => {
      console.info(`⚡ ${this.name} listening on port ${this.port}`);
    });
    return this;
  }
}

const Pigment = (params: PigmentParams) => new PigmentClass(params);

export default Pigment;
export { PigmentEntity, IPigmentEntityParams, Router, ObjectId };
