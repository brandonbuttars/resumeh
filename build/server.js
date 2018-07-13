const npm = require('./npm-tools');

// Arguments
let args = npm.args(process.argv);

// Constructor Strings
let gzip = args.gzip ? '-g ' : '',
    silent = args.silent ? ' -s' : '',
    port = args.test ? '54321' : '8888';

npm.run(`http-server . ${gzip} -p ${port}${silent}`);
