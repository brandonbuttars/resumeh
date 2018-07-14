const npm = require('./npm-tools');

// Arguments
let args = npm.args(process.argv);

// Constructor Strings
let build = args.dist ? 'dist' : 'base',
    compressed = build === 'dist' ? ' --output-style compressed' : '',
    input = 'src/styles/styles.scss',
    output = build === 'dist' ? 'dist/styles/resumeh.min.css' : 'dist/styles/resumeh.css';

let cmd = `if [ ! -d dist/styles ]; then
  mkdir -p dist/styles;
fi
node-sass${compressed} ${input} > ${output}`;

npm.run(cmd);
