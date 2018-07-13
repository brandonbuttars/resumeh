const __ = {
  uid: (topic) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let i = 0, txt = topic.toLowerCase().replace(/[-:\ ]/ig, '_') +'__';
    for (i < 6; i++;) { txt += chars.charAt(Math.floor(Math.random() * chars.length)); }
    return txt;
  },

  publish: (el, topic, info) => {
    if (!el.hOP.call(el.topics, topic)) { return }
    const topics = el.topics[topic],
          keys = Object.keys(topics);
    keys.forEach(key => {
      topics[key](info !== undefined ? info : {});
    });
  },

  subscribe: (el, topic, listener) => {
    const tpc = topic.replace(/[-:\ ]/g, '_'),
          index = __.uid(topic);
    if (!el.hOP.call(el.topics, topic)) { el.topics[topic] = {} }
    el.topics[topic][index] = listener;
    return index;
  },

  unsubscribe: (el, topic, index) => {
    delete el.topics[topic][index];
    if (el.topics[topic] === {}) {
      delete el.topics[topic];
    }
  },

  off: (component, topic, index) => {
    component.on('unmount', () => {
      __.unsubscribe(topic, index);
    });
  }
};

export default class PubSubClass {
  constructor(alias = 'PubSub') {
    this.topics = {};
    this.hOP = this.topics.hasOwnProperty;
    if (!window[alias]) { window[alias] = this }
  }

  fire(topic, info) { __.publish(this, topic, info) }

  on(topic, listener, component = false) {
    const index = __.subscribe(this, topic, listener);
    if (component) { __.off(component, topic, index) }
  }

  off(topic, index) { __.unsubscribe(topic, index) }
}
