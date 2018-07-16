import app from '../../../../config/app';
import riot from 'riot';

const __ = {
  section: () => {
    const hash = location.hash.split('#/')[1];
    return hash !== '' && hash !== undefined ? hash : 'profile';
  }
};

const html = `
  <nav>
    <ul>
      <li hamburger>
        <a href="#" title="Menu">
          <icon is="menu" circle></icon>
        </a>
      </li>
      <li each="{{item in items}}" active="{{opts.section === item.section}}">
        <a href="{{item.section !== 'profile' ? '#/'+ item.section : '#'}}" title="{{item.label}}">
          <icon is="{{item.icon}}" circle></icon>
          <span>{{item.label}}</span>
        </a>
      </li>
      <li>
        <a href="${app.resume.pdf}" target="_blank" title="Download Resume">
          <icon is="file_download" circle></icon>
          <span>Download</span>
        </a>
      </li>
      <li>
        <a href="https://github.com/brandonbuttars/resumeh" target="_blank" title="Repo Code">
          <icon is="code" circle></icon>
          <span>Repo Code</span>
        </a>
      </li>
  </nav>
`;

riot.tag('ui-menu', html, function (opts) {
  const tag = this,
        root = tag.root;
  
  tag.items = [
    { label: 'Profile', icon: 'face', section: 'profile' },
    { label: 'Experience', icon: 'business', section: 'experience' },
    { label: 'Technology', icon: 'important_devices', section: 'technology' },
    { label: 'Education', icon: 'school', section: 'education' },
    { label: 'Portfolio', icon: 'palette', section: 'portfolio' }
  ];

  tag.on('mount', () => {
    const hamburger = root.querySelector('[hamburger] a');

    hamburger.addEventListener('click', function (e) {
      e.preventDefault();
      PubSub.fire('menu:toggle');
    });

    window.addEventListener('resize', () => {
      PubSub.fire('menu:close');
    });
  });
});
