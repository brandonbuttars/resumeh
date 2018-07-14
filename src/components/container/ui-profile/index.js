import app from '../../../../config/app';
import riot from 'riot';

const html = `
  <div if="{{opts.profile}}">
    <h2>Professional Summary</h2>
    <div class="profile-wrapper">
      <markdown code="{{opts.profile.summary}}"></markdown>
    </div>
  </div>
`;

riot.tag('ui-profile', html, function (opts) {
  document.title = app.title.profile;
});
