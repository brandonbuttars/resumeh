import commonjs from 'rollup-plugin-commonjs';
import nodeResolve from 'rollup-plugin-node-resolve';
import uglify from 'rollup-plugin-uglify-es';
import { minify } from 'uglify-es';

const __ = {
  output: (format, sourcemap) => { format, sourcemap },
  uglify: (u) => u ? uglify({}, minify) : false
}

const Rollup = (format = 'es', uglify = true, sourcemap = false) => {
  const ugly = __.uglify(uglify);
  
  const config = {
    output: {
      format: format,
      sourcemap: sourcemap
    },
    plugins: [
      commonjs({
        include: 'node_modules/**',
        extensions: ['.js'],
        ignoreGlobal: false,
        sourceMap: false
      }),
      nodeResolve({
        jsnext: true,
        main: true
      })
    ]
  };
  if (ugly) {
    config.plugins.push(ugly);
  }

  return config;
};

export default Rollup;
