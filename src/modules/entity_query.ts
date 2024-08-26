import { Collection } from "mongodb"
import PigmentEntity, { IPigmentEntityParams } from "./entity";

type TEntityQuery = {[key: string]: any}

export default class EntityQueryBuilder {
  collection: Collection
  baseClass: new (params: IPigmentEntityParams) => PigmentEntity

  constructor(collection: Collection, baseClass: new (params: IPigmentEntityParams) => PigmentEntity) {
    this.collection = collection;
    this.baseClass = baseClass;
  }

  private limit_enabled: boolean = false
  private limit_amount: number = 0
  private skip_amount: number = 0
  private query: {[key: string]: any} = {}
  private single: boolean = false

  find(query: TEntityQuery = {}) {
    this.query = query;
    return this;
  }

  findOne(query: TEntityQuery = {}) {
    this.single = true;
    return this.find(query);
  }

  skip(amount: number) {
    this.skip_amount = amount;
    return this;
  }

  limit(amount: number) {
    this.limit_enabled = true;
    this.limit_amount = amount;
    return this;
  }

  async exec(resolve_links: boolean = true) {
    if(this.single) {
      let item: any = await this.collection.findOne(this.query);
      if(item) {
        item = new this.baseClass(item);
        if(resolve_links) await item.resolve_links();
        return item;
      }
      return null;
    }

    let running_builder = this.collection.find(this.query);
    if(this.limit_enabled) running_builder = running_builder.limit(this.limit_amount);
    running_builder.skip(this.skip_amount);

    let items = (await running_builder.toArray()).map(data => {
      return new this.baseClass(data);
    });

    if(resolve_links) {
      await Promise.all(items.map(item => {
        return item.resolve_links();
      }))
    }

    return items;
  }
}
