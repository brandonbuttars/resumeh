import riot from 'riot';

const __ = {
  open: (event) => {
    event.preventDefault();
    const src = event.target.getAttribute('href');
    document.body.insertAdjacentHTML('beforeend', `<div modal><img src="${src}"/><icon is="close" close-modal></icon></div>`);
    riot.mount('icon');
    setTimeout(() => {
      document.body.setAttribute('has-modal', '');
    }, 100);
  },
  close: () => {
    document.body.removeAttribute('has-modal');
    setTimeout(() => {
      document.body.removeChild(document.querySelector('[modal]'));
    }, 200);
  }
};

const Modal = () => {
  document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', (e) => {
      const t = e.target,
            b = document.body;
      // Open Modal
      if (t.hasAttribute('to-modal')) {
        __.open(e);
      }
      // Close Modal
      if (
        t.nodeName !== 'IMG' &&
        t.parentNode === document.querySelector('[modal]') ||
        (t.parentNode === b && b.hasAttribute('has-modal'))
      ) {
        __.close();
      }
    });
  });
};

export default Modal;
