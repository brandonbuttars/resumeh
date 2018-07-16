# resumeh

Basic show-off repo that could turn into an opensource project for building a basic resume site/app.  I'm connected to some public API end-points I created using [Strapi](https://strapi.io/).

### Built Using:

* [RiotJS](https://riot.js.org/)
* [NPM](https://www.npmjs.com/)
* [Node 9.2](https://nodejs.org/en/)
* [RollupJS](https://rollupjs.org/guide/en)
* [SCSS](https://sass-lang.com/)
* [Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
* [PubSub](https://github.com/brandonbuttars/resumeh/blob/master/src/modules/pubsub.js)
* [BrowserSync](https://browsersync.io/)

## Prep

1. Install `nvm`
2. Run `npm use`
3. Install any missing versions of `node`
4. Install dependencies `npm i`
5. Should be ready to develop.

If you have troubles there may be some global packages you may need to install.  Follow any warning or error prompts that may appear.  If packages are missing, try installing those packages using `npm i -g [package-name]`

## Development

### Run Build with Watch

Run the following command:

```
npm run watch
```

Running this command with build SCSS and JS compiler and keep them watching and running on changes.  It will also start up a BrowserSync server which will reload whenever it detects any changes.  This can be accessed by going to:

[http://localhost:8888](http://localhost:8888)

### Run Dist Build

Run the following command:

```
npm run build:dist
```

This will run the builds for SCSS and JS but will minify them.  It only runs once though and won't watch for any changes.  You can view the files and check a running version with the following server scripts.

#### Dist Server

```
npm run server
```

This will run the server using the `build:dist` files normally without compressing them.

#### GZip Dist Server

```
npm run server:gzip
```

This will run the server using the `build:dist` files and compressing files where it can.

## TODO:

*Add tests.*

