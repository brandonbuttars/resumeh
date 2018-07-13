import app from '../../../../config/app';
import riot from 'riot';

const html = `
  <p><em>Currently being assembled. In the mean time here's some links to things I've done and a few images.</em></p>
  <ul>
    <li each="{{link in links}}">
      <a href="{{link.link}}" target="_blank">{{link.label}}</a>
    </li>
  </ul>
  <dl grid>
    <dd each="{{p in opts.portfolio}}">
      <a data-src="${app.api.root}{{p.file.url}}" to-modal href="${app.api.root}{{p.file.url}}" target="_blank"></a>
    </dd>
  </dl>
`;

riot.tag('portfolio-block', html, function (opts) {
  const tag = this,
        root = tag.root;
  
  tag.links = [
    { label: 'Stuff I\'ve Done (Pinterest)', link: 'https://www.pinterest.com/brandonbuttars/stuff-i-ve-done/' },
    { label: 'NOC Timer', link: 'https://cdn.sorensonspark.com/ticogen/index.html' },
    { label: 'Exported Wireframe', link: 'http://resume.brandonbuttars.com/dist/assets/ImagineLearning' }
  ];

  tag.on('mount', () => {
    const imgs = root.querySelectorAll('[data-src]');
    if (imgs.length > 0) {
      imgs.forEach(i => {
        i.src = i.getAttribute('data-src');
        i.style.cssText = `background-image: url(${i.getAttribute('data-src')})`;
      });
    }
  });  
});
