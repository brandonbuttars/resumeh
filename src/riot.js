// Import all the components
import riot from 'riot';
import './components';

riot.settings.skipAnonymousTags = true;
riot.settings.brackets = '{{ }}';
riot.mount('*');
