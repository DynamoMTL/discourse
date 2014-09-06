define("discourse/routes/application", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var ApplicationRoute = Em.Route.extend({

      actions: {
        showTopicEntrance: function(data) {
          this.controllerFor('topic-entrance').send('show', data);
        },

        composePrivateMessage: function(user) {
          var self = this;
          this.transitionTo('userActivity', user).then(function () {
            self.controllerFor('user-activity').send('composePrivateMessage');
          });
        },

        expandUser: function(user) {
          this.controllerFor('user-expansion').show(user.get('username'), user.get('uploaded_avatar_id'));
          return true;
        },

        error: function(err, transition) {
          if (err.status === 404) {
            // 404
            this.intermediateTransitionTo('unknown');
            return;
          }

          var exceptionController = this.controllerFor('exception'),
              errorString = err.toString();
          if (err.statusText) {
            errorString = err.statusText;
          }
          var c = window.console;
          if (c && c.error) {
            c.error(errorString);
          }
          exceptionController.setProperties({ lastTransition: transition, thrown: err });

          this.intermediateTransitionTo('exception');
        },

        showLogin: function() {
          var self = this;

          if (Discourse.get("isReadOnly")) {
            bootbox.alert(I18n.t("read_only_mode.login_disabled"));
          } else {
            if(Discourse.SiteSettings.enable_sso) {
              var returnPath = encodeURIComponent(window.location.pathname);
              window.location = Discourse.getURL('/session/sso?return_path=' + returnPath);
            } else {
              this.send('autoLogin', 'login', function(){
                Discourse.Route.showModal(self, 'login');
                self.controllerFor('login').resetForm();
              });
            }
          }
        },

        showCreateAccount: function() {
          var self = this;

          self.send('autoLogin', 'createAccount', function(){
            Discourse.Route.showModal(self, 'createAccount');
          });
        },

        autoLogin: function(modal, onFail){
          var methods = Em.get('Discourse.LoginMethod.all');
          if (!Discourse.SiteSettings.enable_local_logins &&
              methods.length === 1) {
                Discourse.Route.showModal(this, modal);
                this.controllerFor('login').send('externalLogin', methods[0]);
          } else {
            onFail();
          }
        },

        showForgotPassword: function() {
          Discourse.Route.showModal(this, 'forgotPassword');
        },

        showNotActivated: function(props) {
          Discourse.Route.showModal(this, 'notActivated');
          this.controllerFor('notActivated').setProperties(props);
        },

        showUploadSelector: function(composerView) {
          Discourse.Route.showModal(this, 'uploadSelector');
          this.controllerFor('upload-selector').setProperties({ composerView: composerView });
        },

        showKeyboardShortcutsHelp: function() {
          Discourse.Route.showModal(this, 'keyboardShortcutsHelp');
        },


        /**
          Close the current modal, and destroy its state.

          @method closeModal
        **/
        closeModal: function() {
          this.render('hide-modal', {into: 'modal', outlet: 'modalBody'});
        },

        /**
          Hide the modal, but keep it with all its state so that it can be shown again later.
          This is useful if you want to prompt for confirmation. hideModal, ask "Are you sure?",
          user clicks "No", showModal. If user clicks "Yes", be sure to call closeModal.

          @method hideModal
        **/
        hideModal: function() {
          $('#discourse-modal').modal('hide');
        },

        /**
          Show the modal. Useful after calling hideModal.

          @method showModal
        **/
        showModal: function() {
          $('#discourse-modal').modal('show');
        },

        editCategory: function(category) {
          var router = this;

          if (category.get('isUncategorizedCategory')) {
            Discourse.Route.showModal(router, 'editCategory', category);
            router.controllerFor('editCategory').set('selectedTab', 'general');
          } else {
            Discourse.Category.reloadById(category.get('id')).then(function (c) {
              Discourse.Site.current().updateCategory(c);
              Discourse.Route.showModal(router, 'editCategory', c);
              router.controllerFor('editCategory').set('selectedTab', 'general');
            });
          }
        },

        /**
          Deletes a user and all posts and topics created by that user.

          @method deleteSpammer
        **/
        deleteSpammer: function (user) {
          this.send('closeModal');
          user.deleteAsSpammer(function() { window.location.reload(); });
        }
      },

      activate: function() {
        this._super();
        Em.run.next(function() {
          // Support for callbacks once the application has activated
          ApplicationRoute.trigger('activate');
        });
      }

    });

    RSVP.EventTarget.mixin(ApplicationRoute);
    __exports__["default"] = ApplicationRoute;
  });

Discourse.ApplicationRoute = require('discourse/routes/application').default;

window.__jshintSrc = window.__jshintSrc || {}; window.__jshintSrc['/assets/discourse/routes/application.js'] = "define(\"discourse/routes/application\", \n  [\"exports\"],\n  function(__exports__) {\n    \"use strict\";\n    var ApplicationRoute = Em.Route.extend({\n\n      actions: {\n        showTopicEntrance: function(data) {\n          this.controllerFor('topic-entrance').send('show', data);\n        },\n\n        composePrivateMessage: function(user) {\n          var self = this;\n          this.transitionTo('userActivity', user).then(function () {\n            self.controllerFor('user-activity').send('composePrivateMessage');\n          });\n        },\n\n        expandUser: function(user) {\n          this.controllerFor('user-expansion').show(user.get('username'), user.get('uploaded_avatar_id'));\n          return true;\n        },\n\n        error: function(err, transition) {\n          if (err.status === 404) {\n            // 404\n            this.intermediateTransitionTo('unknown');\n            return;\n          }\n\n          var exceptionController = this.controllerFor('exception'),\n              errorString = err.toString();\n          if (err.statusText) {\n            errorString = err.statusText;\n          }\n          var c = window.console;\n          if (c \u0026\u0026 c.error) {\n            c.error(errorString);\n          }\n          exceptionController.setProperties({ lastTransition: transition, thrown: err });\n\n          this.intermediateTransitionTo('exception');\n        },\n\n        showLogin: function() {\n          var self = this;\n\n          if (Discourse.get(\"isReadOnly\")) {\n            bootbox.alert(I18n.t(\"read_only_mode.login_disabled\"));\n          } else {\n            if(Discourse.SiteSettings.enable_sso) {\n              var returnPath = encodeURIComponent(window.location.pathname);\n              window.location = Discourse.getURL('/session/sso?return_path=' + returnPath);\n            } else {\n              this.send('autoLogin', 'login', function(){\n                Discourse.Route.showModal(self, 'login');\n                self.controllerFor('login').resetForm();\n              });\n            }\n          }\n        },\n\n        showCreateAccount: function() {\n          var self = this;\n\n          self.send('autoLogin', 'createAccount', function(){\n            Discourse.Route.showModal(self, 'createAccount');\n          });\n        },\n\n        autoLogin: function(modal, onFail){\n          var methods = Em.get('Discourse.LoginMethod.all');\n          if (!Discourse.SiteSettings.enable_local_logins \u0026\u0026\n              methods.length === 1) {\n                Discourse.Route.showModal(this, modal);\n                this.controllerFor('login').send('externalLogin', methods[0]);\n          } else {\n            onFail();\n          }\n        },\n\n        showForgotPassword: function() {\n          Discourse.Route.showModal(this, 'forgotPassword');\n        },\n\n        showNotActivated: function(props) {\n          Discourse.Route.showModal(this, 'notActivated');\n          this.controllerFor('notActivated').setProperties(props);\n        },\n\n        showUploadSelector: function(composerView) {\n          Discourse.Route.showModal(this, 'uploadSelector');\n          this.controllerFor('upload-selector').setProperties({ composerView: composerView });\n        },\n\n        showKeyboardShortcutsHelp: function() {\n          Discourse.Route.showModal(this, 'keyboardShortcutsHelp');\n        },\n\n\n        /**\n          Close the current modal, and destroy its state.\n\n          @method closeModal\n        **/\n        closeModal: function() {\n          this.render('hide-modal', {into: 'modal', outlet: 'modalBody'});\n        },\n\n        /**\n          Hide the modal, but keep it with all its state so that it can be shown again later.\n          This is useful if you want to prompt for confirmation. hideModal, ask \"Are you sure?\",\n          user clicks \"No\", showModal. If user clicks \"Yes\", be sure to call closeModal.\n\n          @method hideModal\n        **/\n        hideModal: function() {\n          $('#discourse-modal').modal('hide');\n        },\n\n        /**\n          Show the modal. Useful after calling hideModal.\n\n          @method showModal\n        **/\n        showModal: function() {\n          $('#discourse-modal').modal('show');\n        },\n\n        editCategory: function(category) {\n          var router = this;\n\n          if (category.get('isUncategorizedCategory')) {\n            Discourse.Route.showModal(router, 'editCategory', category);\n            router.controllerFor('editCategory').set('selectedTab', 'general');\n          } else {\n            Discourse.Category.reloadById(category.get('id')).then(function (c) {\n              Discourse.Site.current().updateCategory(c);\n              Discourse.Route.showModal(router, 'editCategory', c);\n              router.controllerFor('editCategory').set('selectedTab', 'general');\n            });\n          }\n        },\n\n        /**\n          Deletes a user and all posts and topics created by that user.\n\n          @method deleteSpammer\n        **/\n        deleteSpammer: function (user) {\n          this.send('closeModal');\n          user.deleteAsSpammer(function() { window.location.reload(); });\n        }\n      },\n\n      activate: function() {\n        this._super();\n        Em.run.next(function() {\n          // Support for callbacks once the application has activated\n          ApplicationRoute.trigger('activate');\n        });\n      }\n\n    });\n\n    RSVP.EventTarget.mixin(ApplicationRoute);\n    __exports__[\"default\"] = ApplicationRoute;\n  });";
