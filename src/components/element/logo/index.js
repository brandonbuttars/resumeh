import riot from 'riot';

const html = `
  <svg viewBox="0 0 512 512" version="1.1" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
    <g class="logo-group" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
      <circle class="circle" fill="#000" cx="256" cy="256" r="256"></circle>
      <polygon class="buttar-outline" fill="#000" points="92 143.99561 92 288.67652 315.920778 435 420 287.219566 419.348853 152.221786 185.264079 117"></polygon>
      <polygon class="buttar-top" fill="#000" points="108.642477 151.400436 311.012274 218.515988 399.760877 161.338299 183.900946 126.513808"></polygon>
      <polygon class="buttar-left" fill="#000" points="104.256785 279.231831 302.492592 405.631177 302.492592 232.594095 104.256785 161.269622"></polygon>
      <polygon class="buttar-right" fill="#000" points="405.605923 285.743459 317.462419 405.631177 317.462419 232.594095 405.605923 167.78125"></polygon>
    </g>
  </svg>
`;

riot.tag('logo', html, function (opts) {});
