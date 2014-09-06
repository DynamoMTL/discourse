define("discourse/views/application", 
  ["exports"],
  function(__exports__) {
    "use strict";
    __exports__["default"] = Ember.View.extend({
      _appendCategoryClass: function(obj, key) {
        var newClass = Em.get(obj, key);
        if (newClass) {
          $('body').addClass('category-' + newClass);
        }
      }.observes('controller.styleCategory.id'),

      _removeOldClass: function(obj, key) {
        var oldClass = Em.get(obj, key);
        if (oldClass) {
          $('body').removeClass('category-' + oldClass);
        }
      }.observesBefore('controller.styleCategory.id')
    });
  });

Discourse.ApplicationView = require('discourse/views/application').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/discourse/views/application.js'] = "define(\"discourse/views/application\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    __exports__[\"default\"] = Ember.View.extend({\n      _appendCategoryClass: function(obj, key) {\n        var newClass = Em.get(obj, key);\n        if (newClass) {\n          $('body').addClass('category-' + newClass);\n        }\n      }.observes('controller.styleCategory.id'),\n\n      _removeOldClass: function(obj, key) {\n        var oldClass = Em.get(obj, key);\n        if (oldClass) {\n          $('body').removeClass('category-' + oldClass);\n        }\n      }.observesBefore('controller.styleCategory.id')\n    });\n  });";
