import './riot';
import PubSubClass from './modules/pubsub';
import Modal from './modules/modal';

new PubSubClass();
Modal();

PubSub.on('menu:toggle', () => {
  if (document.body.hasAttribute('open')) {
    document.body.removeAttribute('open');
  } else {
    document.body.setAttribute('open', '');
  }
});

PubSub.on('menu:close', () => {
  if (document.body.hasAttribute('open')) {
    document.body.removeAttribute('open');
  }
});
