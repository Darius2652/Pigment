import PigmentEntity from "./entity"

export interface IIndexDecoratorConfig {
  case_sensitive?: boolean
}

function index(field: string, config: IIndexDecoratorConfig = {}) {
  return function(constructor: Function) {
    let c: any = constructor;
    if(c.isPigmentEntity) {
      console.log(`INDEX ${c.name} ON ${field}`)
    }
  }
}

function unique(...field_names: string[]) {
  return function(constructor: Function) {
    let c: any = constructor;
    if(c.isPigmentEntity) {
      c.force_unique(...field_names)
    }
  }
}

function identifier(field: string, ignore_case: boolean = false) {
  return function(constructor: Function) {
    let c: any = constructor;
    if(c.isPigmentEntity) {
      c.identifier_field(field, ignore_case);
    }
  }
}

function REST(base_route?: string) {
  return function(constructor: Function) {
    let c: any = constructor;
    if(c.isPigmentEntity) {
      c.ENABLE_REST(base_route);
    }
  }
}

function lock(instance: any, field: any) {
  if(instance?.constructor?.isPigmentEntity) {
    instance.constructor.lock_field(field);
  }
}

function required(instance: any, field: any) {
  if(instance?.constructor?.isPigmentEntity) {
    instance.constructor.require_field(field);
  }
}

function link_to(other_class: typeof PigmentEntity, other_field?: string) {
  return function(instance: any, field: any) {
    if(instance?.constructor?.isPigmentEntity) {
      instance.constructor.link_field(field, other_class);
      if(other_field) {
        other_class.config.lookups[other_field] = [instance.constructor, field];
      }
    }
  }
}

function hide(instance: any, field: any) {
  if(instance?.constructor?.isPigmentEntity) {
    instance.constructor.config.hidden_fields.push(field);
  }
}

export {
  identifier,
  index,
  unique,
  lock,
  required,
  REST,
  link_to,
  hide,
}
