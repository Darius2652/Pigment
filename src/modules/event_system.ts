export default class EventSystem {
  private events: {[event: string]: Function[]} = {}
  private events_before: {[event: string]: Function[]} = {}
  private static instance_events: {[event: string]: Function[]} = {}
  private static instance_events_before: {[event: string]: Function[]} = {}

  on(event: string, callback: Function) {
    if(!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
  }

  before(event: string, callback: Function) {
    if(!this.events_before[event]) this.events_before[event] = [];
    this.events_before[event].push(callback);
  }

  trigger(event: string) {
    this.events[event]?.forEach((callback: Function) => {
      callback.apply(this);
    })
    this.baseClass.instance_events[event]?.forEach((callback: Function) => {
      callback.apply(this);
    })
  }

  trigger_before(event: string) {
    this.events_before[event]?.forEach((callback: Function) => {
      callback.apply(this);
    })
    this.baseClass.instance_events_before[event]?.forEach((callback: Function) => {
      callback.apply(this);
    })
  }

  static on(event: string, callback: Function) {
    if(!this.instance_events[event]) this.instance_events[event] = [];
    this.instance_events[event].push(callback);
  }

  static before(event: string, callback: Function) {
    if(!this.instance_events_before[event]) this.instance_events_before[event] = [];
    this.instance_events_before[event].push(callback);
  }

  get baseClass(): any {
    return this.constructor;
  }
}
