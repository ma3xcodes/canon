# Canon
Canon is a reusable React environment and set of components for creating visualization engines.

![](https://github.com/datawheel/canon/raw/master/docs/bang.png)

#### Contents
* [Setup and Installation](#setup-and-installation)
* [Running Development Server](#running-development-server)
* [Deployment](#deployment)
* [Header/Meta Information](#header-meta-information)
* [Page Routing](#page-routing)
  * [Window Location](#window-location)
  * [Code Splitting](#code-splitting)
  * [Custom Redirects](#custom-redirects)
* [Hot Module Reloading](#hot-module-reloading)
* [Redux Store](#redux-store)
* [Localization](#localization)
  * [Language Detection](#language-detection)
  * [Changing Languages](#changing-languages)
* [Database models](#database-models)
  * [Basic database setup](#basic-database-setup)
  * [Custom Database Models](#custom-database-models)
* [User Management](#user-management)
  * [Loading User Information](#loading-user-information)
  * [Privacy Policy and Terms of Service](#privacy-policy-and-terms-of-service)
  * [Password Reset](#password-reset)
  * [E-mail Verification](#e-mail-verification)
  * [Roles](#roles)
  * [Social Logins](#social-logins)
    * [Facebook](#facebook)
    * [Github](#github)
    * [Google](#google)
    * [Instagram](#instagram)
    * [LinkedIn](#linkedin)
    * [Twitter](#twitter)
    * [OpenId](#openid)
* [Custom API Routes](#custom-api-routes)
* [Server-Side Caching](#server-side-caching)
* [Opbeat Error Tracking](#opbeat-error-tracking)
* [Additional Environment Variables](#additional-environment-variables)
* [Custom Environment Variables](#custom-environment-variables)

---

## Setup and Installation

Canon is published on NPM, and comes with an initializer package that creates an empty Canon project.  This script will generate a new Canon app with some basic scaffolding and boilerplate code and will setup a basic backend server (written in Node.js Express) and a frontend application (written in React/Redux). To create a new Canon app, simply create a new root folder for your project, navigate to that directory, and run:

```bash
npm init @datawheel/canon
```

All React components are stored in the `app/` directory, with the main entry component being `app/App.jsx`. Here is the initial scaffolding you should see in your project folder:
* `app/` - majority of the front-end site code
  * `components/` - components that are used by multiple pages
  * `pages/` - page-specific components (like the homepage and profiles)
  * `store/` - suggested to save all redux-related files here
    * `index.js` - should export initial state, reducers and middleware for redux
  * `App.jsx` & `App.css` - the main parent component that all pages extend
  * `d3plus.js` - global d3plus visualization styles
  * `helmet.js` - default meta information for all pages to be displayed between the `<head>` tags
  * `routes.jsx` - hook ups for all of the page routes
  * `style.yml` - global color and style variables
* `static/` - static files used by the site like images and PDFs
* `typings` - directory of types to define types of certain variables
* `canon.js` - contains any canon settings/modifications (empty by default)
* `.vscode/` - VSCode editor settings for code linting
* `.env` - a file of environment variables needed to properly configure the app
* `.gitignore` - development files to exclude from the git repository

## Running Development Server

Now that the necessary files are in place, you can run `npm run dev` to spin up the development server. Once the process finished "Bundling Client Webpack", visit `https://localhost:3300` in the browser and view your beautiful Hello World!


---

## Deployment

Deploying a site with canon is as easy as these 2 steps:

* `npm run build` to compile the necessary production server and client bundles
* `npm run start` to start an Express server on the default port

---

## Header/Meta Information

All tags inside of the `<head>` of the rendered page are configured using [Helmet](https://github.com/helmetjs/helmet). If a file is present at `app/helmet.js`, the Object it exports will be used as the configuration. This file can use either ES6 or node style exports, but if you import any other dependencies into that file you must use node's `require` syntax.

Here is an example configuration, as seen in this repo's sample app:

```js
export default {
  link: [
    {rel: "icon", href: "/images/favicon.ico?v=2"},
    {rel: "stylesheet", href: "https://fonts.googleapis.com/css?family=Work+Sans:300,400,500,600,700,900"}
  ],
  meta: [
    {charset: "utf-8"},
    {"http-equiv": "X-UA-Compatible", "content": "IE=edge"},
    {name: "description", content: "Reusable React environment and components for creating visualization engines."},
    {name: "viewport", content: "width=device-width, initial-scale=1"},
    {name: "mobile-web-app-capable", content: "yes"},
    {name: "apple-mobile-web-app-capable", content: "yes"},
    {name: "apple-mobile-web-app-status-bar-style", content: "black"},
    {name: "apple-mobile-web-app-title", content: "Datawheel Canon"}
  ],
  title: "Datawheel Canonical Design"
};
```
---

## Page Routing

All page routes need to be hooked up in `app/routes.jsx`. This filename and location cannot be changed, as the internals of Canon rely on it's presence. For linking between pages, use the [react-router](https://github.com/ReactTraining/react-router) `<Link>` component:

```jsx
import {Link} from "react-router";
...
<Link to="/about">About Page</Link>
```

As a fallback (mainly related to CMS content), Canon also intercepts all `<a>` tags and identifies whether or not they are client-side react friendly links or if they are external links that require a full window location change. If you need to trigger a browser reload (like when [changing languages](#changing-languages)), just add the `data-refresh` attribute to your HTML tag:

```jsx
<a data-refresh="true" href="/?locale=es">Spanish</a>
```

When linking to an anchor ID on the current page, use the `<AnchorLink>` component exported by canon to enable a silky smooth scrollto animation:

```jsx
import {AnchorLink} from "@datawheel/canon-core";
...
<AnchorLink to="economy">Jump to Economy</AnchorLink>
...
<a id="economy" href="#economy">Economy Section</a>
```

If needing to modify the page location with JavaScript, you must use the current active router passed down to any component registered in `app/routes.jsx`. In the past, it was possible to use the `browserHistory` object exported from [react-router](https://github.com/ReactTraining/react-router), but as more advanced routing features have been added to canon, it is now necessary to use the inherited live instance. This live instance is available as `this.props.router`, and can be passed down to any children needing it (either through props or context). Here is an example usage:

```jsx
import React, {Component} from "react";

class Tile extends Component {

  onChangePage() {
    const {router} = this.props;
    router.push("new-route");
  }

  onChangeQuery() {
    const {router} = this.props;
    router.replace("current-route?stuff=here");
  }

}
```

Notice the different usage of `push` and `replace`. Pushing a new URL to the router effects the push/pop history of the browser (so back and forward buttons work), which replacing the URL simply updates the value without effecting the browser history.

### Window Location

There are 3 preferred ways (each with their use cases) to determine the current page the user is viewing:

1. **redux `state.location`** - for server-side rendering, like if you need the current page in a `render` function when a component mounts. This object is created manually on the server-side to mimic `window.location`, but _does NOT get updated on subsequent react-router page views_.
2. **`this.props.router.location`** - every top-level component that is connected to a route in `routes.jsx` has access to the main react-router instance, which should be relied on to always contain the currently viewed page.
3. **`this.context.router.location`** - the current react-router instance is also passed down to every component via context.

### Code Splitting

Code splitting will separate specific JavaScript files and packages from the main app bundle, and be loaded on demand when needed. Canon-core exports a `chunkify` function that imports a file or module as a chunk, changing this:

```js
import Docs from "./pages/Docs.jsx";
```

To this:

```js
import {chunkify} from "@datawheel/canon-core";
const Docs = chunkify(/* #__LOADABLE__ */ () => import("./pages/Docs.jsx"));
```

Webpack will identify anything imported using the `import()` function as a separate chunk, and bundle it separately. Splitting out large components that are only used on a single route can be very beneficial for initial page load time. For example, the `Builder` and `Profile` components exported from canon-cms are automatically split out into separate chunks.

The `chunkify` function accepts an optional 2nd argument, which is used to identify named imports. For example, this code:

```js
import {Glossary} from "./pages/About.jsx";
```

Would be chunked out like this:

```js
import {chunkify} from "@datawheel/canon-core";
const Glossary = chunkify(/* #__LOADABLE__ */ () => import("./pages/About.jsx"), "Glossary");
```

Additionally, it's possibly to group chunks of code together using the `webpackChunkName` magic comment that Webpack recognizes. The following code will group all 3 of these components into a chunk named `"about"`:

```js
const About = chunkify(/* #__LOADABLE__ */ () => import(/* webpackChunkName: "about" */ "./pages/docs/About.jsx"));
const Background = chunkify(/* #__LOADABLE__ */ () => import(/* webpackChunkName: "about" */ "./pages/docs/Background.jsx"));
const Glossary = chunkify(/* #__LOADABLE__ */ () => import(/* webpackChunkName: "about" */ "./pages/docs/Glossary.jsx"));
```

### Custom Redirects

React Router v3 uses `routes.jsx` to organize page routing. Often, you will see pages routed using colons for params, such as `/page/:id`. This is especially true of the CMS, which uses `:slug` and `:id` in this fashion to match with the profile slug and the member id.

Typically, redirects are handled by using router `<Redirect />` directly in `routes.jsx`, allowing for a permanent redirect of a static page. However, as many canon pages make use of `needs`, it may be necessary to process a dynamic redirect, determined by the results of the `need`.

To make use of these custom redirects, ensure that your `need` returns an object that includes a specially named key: `canonRedirect`. In this key, place any NEW override variables you would like to use, keyed exactly as their appearance in the routes.jsx file (such as `:slug` or `:id`).

This functionality is used by the CMS to redirect profiles from their numeric `id` (such as `25`) to their vanity slug (such as `Massachusetts`). When the profile route determines that the user has provided an `id`, it returns an object with a `canonRedirect` that provides the vanity slug via the `id` key. The custom redirect code then performs a `301` redirect, using the lookup object provided by `canonRedirect` to determine the new route.

---

## Hot Module Reloading

Hot module reloading is enabled out of the box, you don't need to add imports to enable it. The current implementation is provided by React Fast Refresh.

If you are upgrading from a previous version of Canon, which used `react-hot-loader`, you will need to remove any reference to it, including manual calls to the `hot()` function.

---

## Redux Store

Some Redux store parameters, especifically the store initial state, reducers, and middleware, can be configured by exporting values on the file `app/store/index.js`.

This file should export three constants:

* `initialState`: an object, whose values will be merged with the default store.
* `middleware`: an array, containing the middlewares that should be applied to enhance the store. The order of execution is first to last, and the internal core middleware are always executed before these ones.
* `reducers`, an object, which should have the same structure as the object you would pass to [the `combineReducers` function](https://redux.js.org/api/combinereducers).

This file can use either ES6 or node style exports, but if you import any other dependencies into that file you must use node's `require` syntax.

Here is an example:

```js
const {reducer: cmsReducer} = require("@datawheel/canon-cms");
const {createLogger} = require("redux-logger");

export const initialState = {
  countries: ["nausa", "sabra", "aschn"]
};

export const middleware = [
  createLogger({...})
];

export const reducers = {
  cms: cmsReducer
};
```

---

## Localization

In order to enable localization for a Canon site, you must first define the available languages as an environment variable:

```sh
export CANON_LANGUAGES="en,es"
```

Next, any component that needs access to localized text needs to be wrapped in the react-i18next `withNamespaces` function:

```jsx
import React, {Component} from "react";
import {Link} from "react-router";
import {withNamespaces} from "react-i18next";

class Nav extends Component {

  render() {

    const {t} = this.props;

    return (
      <nav>
        <Link href="/about">{ t("nav.about") }</Link>
        { t("nav.welcome", {name: "Dave"}) }
      </nav>
    );

  }
}

export default withNamespaces()(Nav);
```

When a component is wrapped with `withNamespaces`, it will have access to a function named `t` inside it's props. This function is what handles fetching the appropriate translation, and also allows us to scrape an entire project to locate every string that needs translation. When you are ready to start populating translations, simply run `npm run locales`.

Canon will search your entire codebase for any component using the `t( )` function. Translations are stored in JSON files in a `locales/` folder in the root directory. In this example, running the script would produce the following file structure:

```
locales/
├── en/
│   ├── [project-name]_old.json
│   └── [project-name].json
└── es/
    ├── [project-name]_old.json
    └── [project-name].json
```

Translations that are in use are stored in a JSON file, while translations that were previously in use (from the last time the script was run) but are no longer in use are stored in the file suffixed `_old`. While running the script, any existing translations will be kept as is, so there is no need to worry about overwriting previous translations.

Since this is our first time running the scraper, both language's translation files will look like this:

```json
{
  "nav": {
    "about": "",
    "welcome": ""
  }
}
```

If you look at your site in this state, now strings will be displayed in the components because their translation values are empty! A filled in translation file would look like this:

```json
{
  "nav": {
    "about": "About",
    "welcome": "Welcome back {{name}}!"
  }
}
```

Notice the second string contains a variable surrounded by two sets of curly brackets. This is the notation for passing variable to translated strings, and is crucial in creating mad-libs style text.

Additionally, to set the default language used in the site on first visit, set the following environment variable (default is `"en"`):

```sh
export CANON_LANGUAGE_DEFAULT="es"
```

### Language Detection

A user's language can be determined in multiple ways. Here is the order of the cascading detection. Once a valid language (one that contains translations in a JSON file) has been detected, the process exits:

1. sub-domain (ie. `https://pt.codelife.com`)
2. `lang` query argument (ie. `https://www.codelife.com?lang=pt`)
3. `language` query argument (ie. `https://www.codelife.com?language=pt`)
4. `locale` query argument (ie. `https://www.codelife.com?locale=pt`)
5. `lng` query argument (ie. `https://www.codelife.com?lng=pt`)

### Changing Languages

In order to change the language of the current page, you must trigger a full browser reload with the new URL. This can be done one of two ways. By using an anchor tag with the `data-refresh` attribute:

```jsx
<a data-refresh="true" href="/?locale=es">Spanish</a>
```

Or in a JavaScript event handler:

```jsx
window.location = "/?locale=es";
```

---

## Database models

Canon implements database connections using the sequelize package. Multiple sequelize models can be defined and loaded through the `canon.js` file at the root of the application, and even using different database connections.

### Basic database setup

A database is defined in the `canon.js` file through the `db` property. This property must be an array of connection detail objects. Inside that object you must define here how it will connect, optionally which other parameters do you want to pass to the sequelize instance, and the list of models that connection will handle:

```js
module.exports = {
  // Each object inside this array is a new database connection
  db: [{
    // Define a connection string...
    connection: "postgresql://username:p4ssw0rd@localhost:5432/database_name",
    // ...or the following connection details
    engine: "postgresql",
    user: "username",
    pass: "p4ssw0rd",
    host: "localhost",
    port: 5432,
    name: "database_name",
    // Optional sequelize options
    sequelizeOptions: {...},
    // The list of sequelize models (database tables) this connection will handle
    tables: [
      // You can reference and combine either of these kinds:
      // - the function that generates the model (see next section)
      require("./app/db/products.js"),
      // - the path to the javascript file that contains that function
      require.resolve("./app/db/sales.js"),
      // - for official canon plugins, add "/models"
      require("@datawheel/canon-core/models")
    ]
  }],
  ...
};
```

Note that referencing the path to the file instead of the function (second method) enables Canon to reload the models if the file is edited while the server is running on development mode. Otherwise you will have to stop and restart Canon to reload these models.

To avoid storing passwords on your repository and get 12factor compliance, set the `connection` key or the connection details as environment variables:

```js
{
  connection: process.env.CANON_DB_CONNECTION1,
  ...
}
```

```bash
export CANON_DB_CONNECTION1="postgresql://username:p4ssw0rd@localhost:5432/database_name"
```

### Custom Database Models

Custom database models should comply with this template:

```js
module.exports = function(sequelize, db) {

  return sequelize.define("testTable",
    {
      id: {
        type: db.INTEGER,
        primaryKey: true
      },
      title: db.STRING,
      favorite: {
        type: db.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }
    }
  );

};
```

These functions are then passed to the [`sequelize.import`](https://sequelize.org/v4/class/lib/sequelize.js~Sequelize.html#instance-method-import) function. These models are then imported directly by nodejs and are not transpiled, so should be written without ES6 or JSX.

## User Management

By setting the following environment variables:

```sh
export CANON_LOGINS=true
```

and adding the canon-core models to your canon.js configuration file:

```js
module.exports = {
  db: [
    {
      host: process.env.CANON_DB_HOST || "localhost",
      name: process.env.CANON_DB_NAME,
      user: process.env.CANON_DB_USER,
      pass: process.env.CANON_DB_PW,
      tables: [
        require("@datawheel/canon-cms/models"),
        require("@datawheel/canon-core/models")     # add this line
      ]
    }
  ]
};

```

Canon will automatically instantiate a "users" table in the specified database to enable full user management. At this point, all that is needed in your application is to use the Login and Signup components exported by Canon:

```jsx
import {Login, SignUp} from "@datawheel/canon-core";
```

These two components can either be used directly with a Route, or as children of other components. They are simple forms that handle all of the authentication and errors. If you would like to change the page the user is redirected to after logging in, you can override the default "redirect" prop:

```jsx
<Login redirect="/profile" />
```

If a `false` value is provided as a redirect, the redirect will be disabled and you must provide you own detection of the `state.auth.user` object in the redux store.

*NOTE*: If also using [social logins](#social-logins), the `CANON_SOCIAL_REDIRECT` environment variable needs to be set in order to change those redirects.

### Loading User Information

Once login/signup forms have been set up, any component that needs access to the currently logged in user needs to dispatch an action to request the information. Ideally, this logic happens in `app/App.jsx` so that anyone can access the user from the redux store:

```jsx
import React, {Component} from "react";
import {connect} from "react-redux";
import {Canon, isAuthenticated} from "@datawheel/canon-core";

class App extends Component {

componentDidMount() {
    this.props.isAuthenticated();
  }

  render() {

    // use this auth object (auth.user) to selectively show/hide components
    // based on whether user is logged in or not
    const auth = this.props.auth;
    console.log(auth);

    return (
      <Canon>
        { auth.user ? `Welcome back ${auth.uesr.username}!` : "Who are you!?" }
        { auth.loading ? "Loading..." : this.props.children }
      </Canon>
    );

  }

}

const mapStateToProps = state => ({
  auth: state.auth
});

const mapDispatchToProps = dispatch => ({
  isAuthenticated: () => {
    dispatch(isAuthenticated());
  }
});

export default connect(mapStateToProps, mapDispatchToProps)(App);
```

### Privacy Policy and Terms of Service

In order to force new users to agree to a Privacy Policy and/or Terms of Service when signing up for a new account, you must specify the valid routes as environment variables. If one or both of these routes are set, then a check box will appear in the `<SignUp>` component with the corresponding page links.

```sh
export CANON_LEGAL_PRIVACY="/privacy"
export CANON_LEGAL_TERMS="/terms"
```

### Password Reset

If a user forgets their password, it is common practice to allow sending their e-mail on file a link to reset it. Canon has built-in [Mailgun](https://www.mailgun.com) support, so once you have set up an account for your project through their website, you can enable this ability with the following environment variables (taken from the [Mailgun](https://www.mailgun.com) developer interface):

```sh
export CANON_MAILGUN_API="key-################################"
export CANON_MAILGUN_DOMAIN="###.###.###"
export CANON_MAILGUN_EMAIL="###@###.###"
```

With those variables set, if a user is trying to log in and types an incorrect password, the alert message will contain a link to reset their password. They will receive an e-mail containing a link that directs them to a page at the route `/reset`. This route needs to be hooked up as part of the **app/routes.jsx** file, and needs to contain the `<Reset />` component exported by Canon. For example:

```jsx
import React from "react";
import {Route} from "react-router";
import {Reset} from "@datawheel/canon-core";

const App = () => "Hello World";

export default () => <Route path="/" component={App}>
  <Route path="reset" component={Reset} />
</Route>;
```

If you would like to change the default path of the reset link, use the following environment variable:

```sh
export CANON_RESET_LINK="/my-reset-route"
```

The `<Reset />` component relies on detecting a unique token in the URL (which is sent in the e-mail to the user). If you would like to embed the component into an existing page, you must pass the Router object to the component on render:

```jsx
<Reset router={ this.props.router } />
```

By default, users are redirected to `/login` after a successful password reset. This can also be changed with a prop:

```jsx
<Reset redirect="/en/login" router={ this.props.router } />
```

When sending e-mails, datahweel-canon will use the "name" field of your **package.json** file as the site name in e-mail correspondence (ex. "Sincerely, the [name] team"). If you'd like to use a more human-readable site name, it can be set with the following environment variable:

```sh
export CANON_MAILGUN_NAME="Datawheel Canon"
```

The default contents of the e-mail to be sent is stored [here](https://github.com/Datawheel/canon/blob/master/src/auth/emails/resetPassword.html), and can be overridden using any local HTML file using the following environment variable:

```sh
export CANON_RESET_HTML="path/to/file.html"
```

The path to this file is relative to the current working directory (`process.cwd()`), and the text inside of the file is run through the i18n parser like all of the front-end client facing components. The associated translation tags can be located under the `mailgun` key inside of the `Reset` key.

### E-mail Verification

If you would like your site to require e-mail verification, you can utilize [Mailgun](https://www.mailgun.com) in a way very similar to the [Password Reset](#password-reset) workflow. Set the appropriate [Mailgun](https://www.mailgun.com) environment variables:

```sh
export CANON_MAILGUN_API="key-################################"
export CANON_MAILGUN_DOMAIN="###.###.###"
export CANON_MAILGUN_EMAIL="###@###.###"
```

And then hook up an `/activate` route with the `<Activate />` component:

```jsx
import React from "react";
import {Route} from "react-router";
import {Activate} from "@datawheel/canon-core";

const App = () => "Hello World";

export default () => <Route path="/" component={App}>
  <Route path="activate" component={Activate} />
</Route>;
```

If you would like to change the default path of the activation link, use the following environment variable:

```sh
export CANON_ACTIVATION_LINK="/my-activation-route"
```

This component needs to be viewed while logged in, and contains a button to resend a verification e-mail with a new token. Similar to the `<Reset />` component, if you would like to use the `<Activate />` component inside of a pre-existing route (such as an account profile page), you must pass the Router location to the component:

```jsx
<Activate location={ this.props.location } />
```

Additionally, the component has an optional property to allow it to be hidden on a page. The verification will still register, but the component itself will render `null`:

```jsx
<Activate hidden={ true } location={ this.props.location } />
```

By default, activation e-mails are only sent when clicking the button in the `<Activate />` component. If you would like to send a verification e-mail when a user first signs up, enable the following environment variable:

```sh
export CANON_SIGNUP_ACTIVATION=true
```

When sending e-mails, datahweel-canon will use the "name" field of your **package.json** file as the site name in e-mail correspondence (ex. "Sincerely, the [name] team"). If you'd like to use a more human-readable site name, it can be set with the following environment variable:

```sh
export CANON_MAILGUN_NAME="Datawheel Canon"
```

The default contents of the e-mail to be sent is stored [here](https://github.com/Datawheel/canon/blob/master/src/auth/emails/activation.html), and can be overridden using any local HTML file using the following environment variable:

```sh
export CANON_ACTIVATION_HTML="path/to/file.html"
```

The path to this file is relative to the current working directory (`process.cwd()`), and the text inside of the file is run through the i18n parser like all of the front-end client facing components. The associated translation tags can be located under the `mailgun` key inside of the `Activation` key.

### Roles

Every new user of a Canon site has a default "role" value of `0`. This value is accessible via the user object in the "auth" redux store object. The default roles are as follows:

* `0` User
* `1` Contributor
* `2` Admin

Canon exports a `<UserAdmin />` component that allows for changing these roles. It is a simple table that displays all users and their current role assignments.

### Social Logins

Once the respective social network application has been set up in their developer interface, Canon looks for a corresponding API and SECRET environment variables to enable that login.

*NOTE*: If deploying using Supervisor, environment variables cannot be wrapped in quotation marks.

If you would like to change the page the user is redirected to after logging in using a social network, an environment variable is needed:

```sh
export CANON_SOCIAL_REDIRECT="/profile"
```

#### Facebook
1. [https://developers.facebook.com](https://developers.facebook.com)
2. Once logged in, hover over "My Apps" in the top right of the page and click "Add a New App"
3. Set up "Facebook Login" as the product.
4. Choose "Web" as the Platform.
5. Skip the Quickstart guide and go directly to "Settings" in the sidebar. Your settings should look like the following image, with at the very least `http://localhost:3300/auth/facebook/callback` in the Valid OAuth redirect URIs. Once there is a production URL, you will need to add that callback URL here along with localhost. ![](https://github.com/datawheel/canon/raw/master/docs/facebook-oauth.png)
6. Go to "Settings" > "Advanced" and turn on "Allow API Access to App Settings" (at the time of writing, it was the last toggle in the "Security" panel)
7. Go to "Settings" > "Basic" and copy the App ID and App Secret to your environment as the following variables:
```sh
export CANON_FACEBOOK_API="###############"
export CANON_FACEBOOK_SECRET="##############################"
```

#### Github
1. [https://github.com/settings/applications/new](https://github.com/settings/applications/new)
2. Fill out the form and set "Authorization callback URL" to `https://localhost/auth/github/callback`
3. Click register application
4. From the next screen copy the Client ID and Client Secret values to:
```
export CANON_GITHUB_API="###############"
export CANON_GITHUB_SECRET="##############################"
```

#### Google
1. [https://console.developers.google.com/](https://console.developers.google.com/)
2. Once logged in, enable the "Google+ API"
3. Go to the "Credentials" tab inside the "Google+ API" settings view and click "Create Credentials" and create OAuth client credentials
4. Click the name of the credentials you created in the previous step
5. For "Authorized JavaScript origins" add `https://localhost`
6. For "Authorized Redirect URIs" add `https://localhost/auth/google/callback`
7. Set the Client ID (CANON_GOOGLE_API) and Client Secret (CANON_GOOGLE_SECRET) values in your environment:
```sh
export CANON_GOOGLE_API="###############"
export CANON_GOOGLE_SECRET="##############################"
```

#### Instagram
1. [https://www.instagram.com/developer/](https://www.instagram.com/developer/)
2. Once logged in, click the "Manage Clients" button in the top navigation, then click the green "Register a New Client" button.
3. Fill out the meta information about your project, but specifically set the "Valid redirect URIs" to `http://localhost:3300/auth/instagram/callback`. Once there is a production URL, you will need to add that callback URL here along with localhost.
4. Click the green "Register" button when done.
5. You should be returned to the page listing all of your projects. Click "Manage" on the current project and copy the Client ID and Client Secret to your environment as the following variables:
```sh
export CANON_INSTAGRAM_API="###############"
export CANON_INSTAGRAM_SECRET="##############################"
```

#### LinkedIn
1. [https://www.linkedin.com/developer/apps/new](https://www.linkedin.com/developer/apps/new)
2. Fill out the form (LinkedIn requires that you add a square image of at least 80x80 px)
3. Click "Submit"
4. Under the OAuth 2.0 section for "Authorized Redirect URLs" enter `https://localhost/auth/linkedin/callback`
5. Click "Add" then click "Update"
6. From the same application settings screen, copy the Client ID and Client Secret values to:
```
export CANON_LINKEDIN_API="###############"
export CANON_LINKEDIN_SECRET="##############################"
```

#### Twitter
1. [https://apps.twitter.com](https://apps.twitter.com)
2. Once logged in, click the "Create New App" button on the top right of the page.
3. Fill out the meta information about your project, but specifically set the "Callback URL" to `http://localhost:3300/auth/twitter/callback`.
4. Go to the "Key and Access Tokens" tab and copy the Consumer Key (API Key) and Consumer Secret (API Secret) to your environment as the following variables:
```sh
export CANON_TWITTER_API="###############"
export CANON_TWITTER_SECRET="##############################"
```
5. Click the "Permissions" tab then at the bottom under "Additional Permissions" check the box that reads "Request email addresses from users" (if you would like to request e-mail addresses from users).
---

#### OpenId
1. Ask the client for the SSO service they have.
2. If it is supported under the [OpenId](https://openid.net/) standard complete the following variables:
```sh
export CANON_OPENID_API="https://openid.server"
export CANON_OPENID_API_AUTHORIZE="https://openid.server/protocol/openid-connect/auth"
export CANON_OPENID_API_TOKEN="https://openid.server/protocol/openid-connect/token"
export CANON_OPENID_API_USERINFO="https://openid.server/protocol/openid-connect/userinfo"
export CANON_OPENID_ID="###############"
export CANON_OPENID_SECRET="##############################"
export CANON_OPENID_ROLES="profile,email"
```
3. (Optional) To fully log out of OpenId on Canon Logout, set this variable:
```sh
export CANON_OPENID_LOGOUT="https://login.microsoftonline.com/###/oauth2/v2.0/logout"
```

---

## Custom API Routes

If you app requires custom API routes, Canon will import any files located in a `api/` directory and attach them to the current Express instance. For example, a file located at `api/simpleRoute.js`:

```js
module.exports = function(app) {

  app.get("/api/simple", (req, res) => {

    res.json({simple: true}).end();

  });

};
```

*NOTE*: Custom API routes are written using Node module syntax, not ES6/JSX.

If you'd like to interact with the database in a route, the Express app contains the Sequelize instance as part of it's settings:

```js
module.exports = function(app) {

  const {db} = app.settings;

  app.get("/api/user", (req, res) => {

    db.users.findAll({where: req.query}).then(u => res.json(u).end());

  });

};
```

Additionally, if you would like certain routes to only be reachable if a user is logged in, you can use this simple middleware to reject users that are not logged in:

```js
const authRoute = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  return res.status(401).send("you are not logged in...");
};

module.exports = function(app) {

  app.get("/api/authenticated", authRoute, (req, res) => {

    res.status(202).send("you are logged in!").end();

  });

};
```

---

## Server-Side Caching

Some projects benefit by creating a server-side data cache to be used in API routes (for example, metadata about cube dimensions). Canon imports all files present in the top level `cache/` directory, and stores their return contents in `app.settings.cache` based on their filename. For example, to store the results of an API request in the cache, you could create the following file at `cache/majors.js`:

```js
const axios = require("axios");

module.exports = function() {

  return axios.get("https://api.datausa.io/attrs/cip/")
    .then(d => d.data);

};
```

The results of this promise can then be used in an API route:

```js
module.exports = function(app) {

  const {cache} = app.settings;

  app.get("/api/cache/majors", (req, res) => {

    res.json(cache.majors).end();

  });

};
```

---

## Opbeat Error Tracking

If you would like to enable error tracking using Opbeat, add these 3 environment variables after initializing the app in the Opbeat online interface:

```sh
export CANON_OPBEAT_APP=your-opbeat-app-id
export CANON_OPBEAT_ORG=your-opbeat-organization-id
export CANON_OPBEAT_TOKEN=your-opbeat-secret-token
```

*NOTE*: Opbeat runs as express middleware, and will only track in production environments.

---

## Additional Environment Variables

Interacting with the internals of canon is done by specifying environment variables. The recommended way to set environment variables is to use `direnv` (installed with `brew install direnv`), which will detect any file named `.envrc` located in a project folder. This file should not be pushed to the repository, as it usually contains variables specific to the current environment (testing locally, running on a server etc).

Here is an example `.envrc` file which turns off the default redux messages seen in the browser console and changes the default localization language:

```sh
export CANON_LOGREDUX=false
export CANON_LANGUAGE_DEFAULT="es"
```

|variable|description|default|
|---|---|---|
|`CANON_API`|Used as a prefix with the fetchData action and the attribute types returned from the `ATTRS` url.|`undefined`|
|`CANON_BASE_URL`|If hosting assets or running the server from a different location that the project folder, this variable can be used to define the base URL for all static assets. A `<base>` tag will be added to the start of the `<head>` tag.|`undefined`|
|`CANON_GOOGLE_ANALYTICS`|The unique Google Analytics ID for the project (ex. `"UA-########-#"`). This also supports comma-separated values, if it's desired for pageviews to be reported to multiple analytics properties.|`undefined`|
|`CANON_FACEBOOK_PIXEL`|The unique Facebook Pixel ID for the project (ex. `"################"`).|`undefined`|
|`CANON_GOOGLE_OPTIMIZE`|The unique Google Optimize ID to run user tests. It loads the [synchronous version](https://support.google.com/optimize/answer/9692472]). Read more [here](https://optimize.google.com):  (ex. `"OPT-#######"`).|`undefined`|
|`CANON_GDPR`|When set to `true`, tracking services like Google Analytics and Faceboook Pixel will only be loaded after the user accepts the usage of cookies and tracking. A pop-up Drawer will be shown on the bottom of the screen containing text and buttons that are editable in the locales JSON file.|`false`|
|`CANON_GDPR_WAIT`|By default, if a user has not chosen whether to accept or reject the GDPR message, we will assume consent and not ask on subsequent page visits. If this env var is set to `true`, tracking services will only execute after the user has explicitly accepted.|`false`|
|`CANON_GOOGLE_TAG_MANAGER`|The unique Google Tag Manager ID for the project (ex. `"GTM-#######"`).|`undefined`|
|`CANON_HELMET_FRAMEGUARD`|Pass-through option for the "frameguard" property of the [helmet](https://github.com/helmetjs/helmet#how-it-works) initialization.|`false`|
|`CANON_HOTJAR`|The unique Hotjar ID for the project (ex. `"#######"`).|`undefined`|
|`CANON_LOGREDUX`|Whether or not to display the (rather verbose) Redux store events in the browser console.|`true`|
|`CANON_LOGLOCALE`|Whether or not to display the (rather verbose) i18n locale events in the browser console.|`false`|
|`CANON_PORT`|The port to use for the server.|`3300`|
|`CANON_SESSION_SECRET`|A unique secret key to use for cookies.|The "name" field from package.json|
|`CANON_SESSION_TIMEOUT`|The timeout, in milliseconds, for user authentication cookies.|`60 * 60 * 1000` (one hour)|
|`CANON_STATIC_FOLDER`|Changes the default folder name for static assets.|`"static"`|
|`NODE_ENV`|The current environment. Setting to `production` will result in the removal of browser development tools and return smaller package sizes.|`development`|

Additional environment variables can also be set (and may be required) for canon plugins:

* [cms](https://github.com/Datawheel/canon/tree/master/packages/cms#environment-variables)
* [logiclayer](https://github.com/Datawheel/canon/tree/master/packages/logiclayer#canon-logic-layer)

## Custom Environment Variables

In addition to the predefined environment variabels, you can also pass any variable to the front-end using the `CANON_CONST_*` wildcard naming convention. Any environment variable that begins with `CANON_CONST_` will be passed through to the redux store to be available in the front-end. For example, given the following environment variable:

```sh
export CANON_CONST_API2=https://api.datausa.io/
```

This variable can now be referenced as `API2` in a front-end React component:

```jsx
import React, {Component} from "react";
import {connect} from "react-redux";

class Viz extends Component {

  render() {

    const {API2} = this.props;

  }

}

const mapStateToProps = state => ({
  API2: state.env.API2
});

export default connect(mapStateToProps)(Viz);
```
