const npm = require('./npm-tools');

// Arguments
const args = npm.args(process.argv);

function getEnv() {
  if (args.es) {
    return 'es';
  } else if (args.cjs) {
    return 'cjs';
  } else if (args.iife) {
    return 'iife';
  } else {
    return 'base';
  }
}

// Build Variables
const build = getEnv(),
      config = `-c ./config/rollup/${build}.rollup.js`,
      watch = args.watch ? ' -w' : '',
      input = `-i ./index.js`,
      filename = `${build}.resumeh.js`,
      output = `-o ./dist/scripts/${filename}`,
      cmd = `rollup ${config} ${input} ${output}${watch}`;

npm.run(cmd);
