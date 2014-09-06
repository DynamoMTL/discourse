define("discourse/controllers/application", 
  ["exports"],
  function(__exports__) {
    "use strict";
    __exports__["default"] = Ember.Controller.extend({
      styleCategory: null,

      canSignUp: function() {
        return !Discourse.SiteSettings.invite_only &&
               Discourse.SiteSettings.allow_new_registrations &&
               !Discourse.SiteSettings.enable_sso;
      }.property(),
    });
  });

Discourse.ApplicationController = require('discourse/controllers/application').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/discourse/controllers/application.js'] = "define(\"discourse/controllers/application\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    __exports__[\"default\"] = Ember.Controller.extend({\n      styleCategory: null,\n\n      canSignUp: function() {\n        return !Discourse.SiteSettings.invite_only \u0026\u0026\n               Discourse.SiteSettings.allow_new_registrations \u0026\u0026\n               !Discourse.SiteSettings.enable_sso;\n      }.property(),\n    });\n  });";
