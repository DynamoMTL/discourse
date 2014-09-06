/*global I18n:true */

// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/indexOf
if (!Array.prototype.indexOf) {
  Array.prototype.indexOf = function (searchElement, fromIndex) {
    if ( this === undefined || this === null ) {
      throw new TypeError( '"this" is null or not defined' );
    }

    var length = this.length >>> 0; // Hack to convert object.length to a UInt32

    fromIndex = +fromIndex || 0;

    if (Math.abs(fromIndex) === Infinity) {
      fromIndex = 0;
    }

    if (fromIndex < 0) {
      fromIndex += length;
      if (fromIndex < 0) {
        fromIndex = 0;
      }
    }

    for (;fromIndex < length; fromIndex++) {
      if (this[fromIndex] === searchElement) {
        return fromIndex;
      }
    }

    return -1;
  };
}

// Instantiate the object
var I18n = I18n || {};

// Set default locale to english
I18n.defaultLocale = "en";

// Set default handling of translation fallbacks to false
I18n.fallbacks = false;

// Set default separator
I18n.defaultSeparator = ".";

// Set current locale to null
I18n.locale = null;

// Set the placeholder format. Accepts `{{placeholder}}` and `%{placeholder}`.
I18n.PLACEHOLDER = /(?:\{\{|%\{)(.*?)(?:\}\}?)/gm;

I18n.fallbackRules = {};

I18n.pluralizationRules = {
  en: function(n) {
    return n === 0 ? ["zero", "none", "other"] : n === 1 ? "one" : "other";
  },
  "zh_CN": function(n) {
    return n === 0 ? ["zero", "none", "other"] : "other";
  },
  "zh_TW": function(n) {
    return n === 0 ? ["zero", "none", "other"] : "other";
  },
  "ko": function(n) {
    return n === 0 ? ["zero", "none", "other"] : "other";
  }
};

I18n.getFallbacks = function(locale) {
  if (locale === I18n.defaultLocale) {
    return [];
  } else if (!I18n.fallbackRules[locale]) {
    var rules = [],
        components = locale.split("-");

    for (var l = 1; l < components.length; l++) {
      rules.push(components.slice(0, l).join("-"));
    }

    rules.push(I18n.defaultLocale);

    I18n.fallbackRules[locale] = rules;
  }

  return I18n.fallbackRules[locale];
};

I18n.isValidNode = function(obj, node, undefined) {
  return obj[node] !== null && obj[node] !== undefined;
};

I18n.lookup = function(scope, options) {
  options = options || {};
  var lookupInitialScope = scope,
      translations = this.prepareOptions(I18n.translations),
      locale = options.locale || I18n.currentLocale(),
      messages = translations[locale] || {},
      currentScope;

  options = this.prepareOptions(options);

  if (typeof scope === "object") {
    scope = scope.join(this.defaultSeparator);
  }

  if (options.scope) {
    scope = options.scope.toString() + this.defaultSeparator + scope;
  }

  scope = scope.split(this.defaultSeparator);

  while (messages && scope.length > 0) {
    currentScope = scope.shift();
    messages = messages[currentScope];
  }

  if (!messages) {
    if (I18n.fallbacks) {
      var fallbacks = this.getFallbacks(locale);
      for (var fallback = 0; fallback < fallbacks.length; fallbacks++) {
        messages = I18n.lookup(lookupInitialScope, this.prepareOptions({locale: fallbacks[fallback]}, options));
        if (messages) {
          break;
        }
      }
    }

    if (!messages && this.isValidNode(options, "defaultValue")) {
        messages = options.defaultValue;
    }
  }

  return messages;
};

// Merge serveral hash options, checking if value is set before
// overwriting any value. The precedence is from left to right.
//
//   I18n.prepareOptions({name: "John Doe"}, {name: "Mary Doe", role: "user"});
//   #=> {name: "John Doe", role: "user"}
//
I18n.prepareOptions = function() {
  var options = {},
      opts,
      count = arguments.length;

  for (var i = 0; i < count; i++) {
    opts = arguments[i];

    if (!opts) {
      continue;
    }

    for (var key in opts) {
      if (!this.isValidNode(options, key)) {
        options[key] = opts[key];
      }
    }
  }

  return options;
};

I18n.interpolate = function(message, options) {
  options = this.prepareOptions(options);
  var matches = message.match(this.PLACEHOLDER),
      placeholder,
      value,
      name;

  if (!matches) {
    return message;
  }

  for (var i = 0; placeholder = matches[i]; i++) {
    name = placeholder.replace(this.PLACEHOLDER, "$1");

    value = options[name];

    if (!this.isValidNode(options, name)) {
      value = "[missing " + placeholder + " value]";
    }

    var regex = new RegExp(placeholder.replace(/\{/gm, "\\{").replace(/\}/gm, "\\}"));
    message = message.replace(regex, value);
  }

  return message;
};

I18n.translate = function(scope, options) {
  options = this.prepareOptions(options);
  var translation = this.lookup(scope, options);

  try {
    if (typeof translation === "object") {
      if (typeof options.count === "number") {
        return this.pluralize(options.count, scope, options);
      } else {
        return translation;
      }
    } else {
      return this.interpolate(translation, options);
    }
  } catch (error) {
    return this.missingTranslation(scope);
  }
};

I18n.localize = function(scope, value) {
  switch (scope) {
    case "currency":
      return this.toCurrency(value);
    case "number":
      scope = this.lookup("number.format");
      return this.toNumber(value, scope);
    case "percentage":
      return this.toPercentage(value);
    default:
      if (scope.match(/^(date|time)/)) {
        return this.toTime(scope, value);
      } else {
        return value.toString();
      }
  }
};

I18n.parseDate = function(date) {
  var matches, convertedDate;

  // we have a date, so just return it.
  if (typeof date === "object") {
    return date;
  }

  // it matches the following formats:
  //   yyyy-mm-dd
  //   yyyy-mm-dd[ T]hh:mm::ss
  //   yyyy-mm-dd[ T]hh:mm::ss
  //   yyyy-mm-dd[ T]hh:mm::ssZ
  //   yyyy-mm-dd[ T]hh:mm::ss+0000
  //
  matches = date.toString().match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?(Z|\+0000)?/);

  if (matches) {
    for (var i = 1; i <= 6; i++) {
      matches[i] = parseInt(matches[i], 10) || 0;
    }

    // month starts on 0
    matches[2] -= 1;

    if (matches[7]) {
      convertedDate = new Date(Date.UTC(matches[1], matches[2], matches[3], matches[4], matches[5], matches[6]));
    } else {
      convertedDate = new Date(matches[1], matches[2], matches[3], matches[4], matches[5], matches[6]);
    }
  } else if (typeof date === "number") {
    // UNIX timestamp
    convertedDate = new Date();
    convertedDate.setTime(date);
  } else if (date.match(/\d+ \d+:\d+:\d+ [+-]\d+ \d+/)) {
    // a valid javascript format with timezone info
    convertedDate = new Date();
    convertedDate.setTime(Date.parse(date));
  } else {
    // an arbitrary javascript string
    convertedDate = new Date();
    convertedDate.setTime(Date.parse(date));
  }

  return convertedDate;
};

I18n.toTime = function(scope, d) {
  var date = this.parseDate(d),
      format = this.lookup(scope);

  if (date.toString().match(/invalid/i)) {
    return date.toString();
  }

  if (!format) {
    return date.toString();
  }

  return this.strftime(date, format);
};

I18n.strftime = function(date, format) {
  var options = this.lookup("date");

  if (!options) {
    return date.toString();
  }

  options.meridian = options.meridian || ["AM", "PM"];

  var weekDay = date.getDay(),
      day = date.getDate(),
      year = date.getFullYear(),
      month = date.getMonth() + 1,
      hour = date.getHours(),
      hour12 = hour,
      meridian = hour > 11 ? 1 : 0,
      secs = date.getSeconds(),
      mins = date.getMinutes(),
      offset = date.getTimezoneOffset(),
      absOffsetHours = Math.floor(Math.abs(offset / 60)),
      absOffsetMinutes = Math.abs(offset) - (absOffsetHours * 60),
      timezoneoffset = (offset > 0 ? "-" : "+") + (absOffsetHours.toString().length < 2 ? "0" + absOffsetHours : absOffsetHours) + (absOffsetMinutes.toString().length < 2 ? "0" + absOffsetMinutes : absOffsetMinutes);

  if (hour12 > 12) {
    hour12 = hour12 - 12;
  } else if (hour12 === 0) {
    hour12 = 12;
  }

  var padding = function(n) {
    var s = "0" + n.toString();
    return s.substr(s.length - 2);
  };

  var f = format;
  f = f.replace("%a", options.abbr_day_names[weekDay]);
  f = f.replace("%A", options.day_names[weekDay]);
  f = f.replace("%b", options.abbr_month_names[month]);
  f = f.replace("%B", options.month_names[month]);
  f = f.replace("%d", padding(day));
  f = f.replace("%e", day);
  f = f.replace("%-d", day);
  f = f.replace("%H", padding(hour));
  f = f.replace("%-H", hour);
  f = f.replace("%I", padding(hour12));
  f = f.replace("%-I", hour12);
  f = f.replace("%m", padding(month));
  f = f.replace("%-m", month);
  f = f.replace("%M", padding(mins));
  f = f.replace("%-M", mins);
  f = f.replace("%p", options.meridian[meridian]);
  f = f.replace("%S", padding(secs));
  f = f.replace("%-S", secs);
  f = f.replace("%w", weekDay);
  f = f.replace("%y", padding(year));
  f = f.replace("%-y", padding(year).replace(/^0+/, ""));
  f = f.replace("%Y", year);
  f = f.replace("%z", timezoneoffset);

  return f;
};

I18n.toNumber = function(number, options) {
  options = this.prepareOptions(
    options,
    this.lookup("number.format"),
    {precision: 3, separator: ".", delimiter: ",", strip_insignificant_zeros: false}
  );

  var negative = number < 0,
      string = Math.abs(number).toFixed(options.precision).toString(),
      parts = string.split("."),
      precision,
      buffer = [],
      formattedNumber;

  number = parts[0];
  precision = parts[1];

  while (number.length > 0) {
    buffer.unshift(number.substr(Math.max(0, number.length - 3), 3));
    number = number.substr(0, number.length -3);
  }

  formattedNumber = buffer.join(options.delimiter);

  if (options.precision > 0) {
    formattedNumber += options.separator + parts[1];
  }

  if (negative) {
    formattedNumber = "-" + formattedNumber;
  }

  if (options.strip_insignificant_zeros) {
    var regex = {
        separator: new RegExp(options.separator.replace(/\./, "\\.") + "$"),
        zeros: /0+$/
    };

    formattedNumber = formattedNumber
      .replace(regex.zeros, "")
      .replace(regex.separator, "")
    ;
  }

  return formattedNumber;
};

I18n.toCurrency = function(number, options) {
  options = this.prepareOptions(
    options,
    this.lookup("number.currency.format"),
    this.lookup("number.format"),
    {unit: "$", precision: 2, format: "%u%n", delimiter: ",", separator: "."}
  );

  number = this.toNumber(number, options);
  number = options.format
    .replace("%u", options.unit)
    .replace("%n", number)
  ;

  return number;
};

I18n.toHumanSize = function(number, options) {
  var kb = 1024,
      size = number,
      iterations = 0,
      unit,
      precision;

  while (size >= kb && iterations < 4) {
    size = size / kb;
    iterations += 1;
  }

  if (iterations === 0) {
    unit = this.t("number.human.storage_units.units.byte", {count: size});
    precision = 0;
  } else {
    unit = this.t("number.human.storage_units.units." + [null, "kb", "mb", "gb", "tb"][iterations]);
    precision = (size - Math.floor(size) === 0) ? 0 : 1;
  }

  options = this.prepareOptions(
    options,
    {precision: precision, format: "%n%u", delimiter: ""}
  );

  number = this.toNumber(size, options);
  number = options.format
    .replace("%u", unit)
    .replace("%n", number)
  ;

  return number;
};

I18n.toPercentage = function(number, options) {
  options = this.prepareOptions(
    options,
    this.lookup("number.percentage.format"),
    this.lookup("number.format"),
    {precision: 3, separator: ".", delimiter: ""}
  );

  number = this.toNumber(number, options);
  return number + "%";
};

I18n.pluralizer = function(locale) {
  var pluralizer = this.pluralizationRules[locale];
  if (pluralizer !== undefined) return pluralizer;
  return this.pluralizationRules["en"];
};

I18n.findAndTranslateValidNode = function(keys, translation) {
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (this.isValidNode(translation, key)) return translation[key];
  }
  return null;
};

I18n.pluralize = function(count, scope, options) {
  var translation;

  try { translation = this.lookup(scope, options); } catch (error) {}
  if (!translation) { return this.missingTranslation(scope); }

  options = this.prepareOptions(options);
  options.count = count.toString();

  var pluralizer = this.pluralizer(this.currentLocale());
  var key = pluralizer(Math.abs(count));
  var keys = ((typeof key === "object") && (key instanceof Array)) ? key : [key];

  var message = this.findAndTranslateValidNode(keys, translation);
  if (message == null) message = this.missingTranslation(scope, keys[0]);

  return this.interpolate(message, options);
};

I18n.missingTranslation = function(scope, key) {
  var message = '[' + this.currentLocale() + "." + scope;
  if (key) { message += "." + key; }
  return message + ']';
};

I18n.currentLocale = function() {
  return (I18n.locale || I18n.defaultLocale);
};

// shortcuts
I18n.t = I18n.translate;
I18n.l = I18n.localize;
I18n.p = I18n.pluralize;

I18n.enable_verbose_localization = function(){
  var counter = 0;
  var keys = {};
  var t = I18n.t;


  I18n.t = I18n.translate = function(scope, value){
    var current = keys[scope];
    if(!current) {
      current = keys[scope] = ++counter;
      var message = "Translation #" + current + ": " + scope;
      if (!_.isEmpty(value)) {
        message += ", parameters: " + JSON.stringify(value);
      }
      window.console.log(message);
    }
    return t.apply(I18n, [scope, value]) + " (t" + current + ")";
  };
};


I18n.verbose_localization_session = function(){
  sessionStorage.setItem("verbose_localization", "true");
  I18n.enable_verbose_localization();
}

try {
  if(sessionStorage && sessionStorage.getItem("verbose_localization")) {
    I18n.enable_verbose_localization();
  }
} catch(e){
  // we don't care really, can happen if cookies disabled
}
;


MessageFormat = {locale: {}};
MessageFormat.locale.sv = function ( n ) {
  if ( n === 1 ) {
    return "one";
  }
  return "other";
};

I18n.messageFormat = (function(formats){
      var f = formats;
      return function(key, options) {
        var fn = f[key];
        if(fn){
          try {
            return fn(options);
          } catch(err) {
            return err.message;
          }
        } else {
          return 'Missing Key: ' + key
        }
        return f[key](options);
      };
    })({"topic.read_more_MF" : function(d){
var r = "";
r += "Det ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "UNREAD";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
r += "finns <a href='/unread'>1 oläst</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "finns <a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " olästa</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sv"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "NEW";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "and ";
return r;
},
"false" : function(d){
var r = "";
r += "is ";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='/new'>1 ny</a> tråd";
return r;
},
"other" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "and ";
return r;
},
"false" : function(d){
var r = "";
r += "are ";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='/new'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " nya</a> trådar";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["sv"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " kvar, eller ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "se fler trådar i ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["catLink"];
return r;
},
"false" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["latestLink"];
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
r += ".";
return r;
}});I18n.translations = {"sv":{"js":{"number":{"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}}},"dates":{"tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c 1s","other":"\u003c %{count}s"},"x_seconds":{"one":"1s","other":"%{count}s"},"less_than_x_minutes":{"one":"\u003c 1m","other":"\u003c %{count}m"},"x_minutes":{"one":"1m","other":"%{count}m"},"about_x_hours":{"one":"1h","other":"%{count}h"},"x_days":{"one":"1d","other":"%{count}d"},"about_x_years":{"one":"1å","other":"%{count}å"},"over_x_years":{"one":"\u003e 1å","other":"\u003e %{count}å"},"almost_x_years":{"one":"1å","other":"%{count}å"},"date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"1 min","other":"%{count} min"},"x_hours":{"one":"1 tim","other":"%{count} tim"},"x_days":{"one":"1 dag","other":"%{count} dagar"}},"medium_with_ago":{"x_minutes":{"one":"1 min sedan","other":"%{count} min sedan"},"x_hours":{"one":"1 timme sedan","other":"%{count} tim sedan"},"x_days":{"one":"1 dag sedan","other":"%{count} dagar sedan"}}},"share":{"topic":"dela en länk till denna tråd","post":"dela en länk till denna tråd","close":"stäng","twitter":"dela denna länk på Twitter","facebook":"dela denna länk på Facebook","google+":"dela denna länk på Google+","email":"skicka denna länk i ett email"},"edit":"redigera titel och kategori för denna tråd","not_implemented":"Denna funktion har inte implementerats än, vi beklagar!","no_value":"Nej","yes_value":"Ja","generic_error":"Vi beklagar, ett fel har inträffat.","generic_error_with_reason":"Ett fel inträffade: %{error}","sign_up":"Registrera","log_in":"Logga in","age":"Ålder","joined":"Gick med","admin_title":"Admin","flags_title":"Flaggningar","show_more":"visa mer","links":"Länkar","links_lowercase":"länkar","faq":"FAQ","guidelines":"Riktlinjer","privacy_policy":"Integritetspolicy","privacy":"Integritet","terms_of_service":"Villkor","mobile_view":"Mobilvy","desktop_view":"Desktop-vy","you":"Du","or":"eller","now":"nyss","read_more":"läs mer","more":"Mer","less":"Mindre","never":"aldrig","daily":"dagligen","weekly":"veckovis","every_two_weeks":"varannan vecka","max":"max","character_count":{"one":"{{count}} tecken","other":"{{count}} tecken"},"in_n_seconds":{"one":"om 1 sekund","other":"om {{count}} sekunder"},"in_n_minutes":{"one":"om 1 minut","other":"om {{count}} minuter"},"in_n_hours":{"one":"om 1 timme","other":"om {{count}} timmar"},"in_n_days":{"one":"om 1 dag","other":"om {{count}} dagar"},"suggested_topics":{"title":"Föreslagna trådar"},"about":{"simple_title":"Om","title":"Om %{title}","stats":"Sitestatistik","our_admins":"Våra administratörer","our_moderators":"Våra moderatorer","stat":{"all_time":"Alla dagar","last_7_days":"Senaste 7 dagarna"},"like_count":"Likes","topic_count":"Antal diskussioner","post_count":"Antal inlägg","user_count":"Antal användare"},"bookmarks":{"not_logged_in":"förlåt, men du måste vara inloggad för att kunna bokmärka inlägg","created":"du har bokmärkt det här inlägget","not_bookmarked":"du har läst detta inlägg, klicka för att bokmärka det","last_read":"detta är det senaste inlägg som du läst, klicka för att bokmärka","remove":"Ta bort bokmärke"},"topic_count_latest":{"one":"{{count}} ny eller uppdaterad diskussion","other":"{{count}} nya eller uppdaterade diskussioner"},"topic_count_unread":{"one":"{{count}} oläst diskussion","other":"{{count}} olästa diskussioner"},"topic_count_new":{"one":"{{count}} ny diskussion","other":"{{count}} nya diskussioner"},"click_to_show":"Klicka för att visa.","preview":"förhandsgranska","cancel":"avbryt","save":"Spara ändringar","saving":"Sparar...","saved":"Sparat!","upload":"Ladda upp","uploading":"Laddar upp...","uploaded":"Uppladdad!","enable":"Aktivera","disable":"Avaktivera","undo":"Ångra","revert":"Återställ","banner":{"close":"Stäng denna banner"},"choose_topic":{"none_found":"Inga trådar hittades.","title":{"search":"Sök tråd baserat på namn, url eller id:","placeholder":"skriv trådens titel här"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e postade \u003ca href='{{topicUrl}}'\u003etiteln\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eDu\u003c/a\u003e postade \u003ca href='{{topicUrl}}'\u003etiteln\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e svarade på \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eDu\u003c/a\u003e svarade på \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e svarade på \u003ca href='{{topicUrl}}'\u003etråden\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eDu\u003c/a\u003e svarade på \u003ca href='{{topicUrl}}'\u003etråden\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e nämnde \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e nämnde \u003ca href='{{user2Url}}'\u003edig\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eDu\u003c/a\u003e nämnde \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Postat av \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Postat av \u003ca href='{{userUrl}}'\u003edig\u003c/a\u003e","sent_by_user":"Skickat av \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Skickat av \u003ca href='{{userUrl}}'\u003edig\u003c/a\u003e"},"groups":{"visible":"Gruppen är synlig för alla användare","title":{"one":"grupp","other":"grupper"},"members":"medlemmar","posts":"inlägg","alias_levels":{"title":"Vem kan använda denna grupp som ett alias?","nobody":"ingen","only_admins":"bara admins","mods_and_admins":"bara moderatorer och admins","members_mods_and_admins":"bara gruppmedlemmar, moderatorer och admins","everyone":"alla"}},"user_action_groups":{"1":"Gillningar givna","2":"Gillningar mottagna","3":"Bokmärken","4":"Trådar","5":"Inlägg","6":"Svar","7":"Omnämnanden","9":"Citat","10":"Stjärnmärkt","11":"Redigeringar","12":"Skickade föremål","13":"Inkorg"},"categories":{"all":"alla kategorier","all_subcategories":"alla","no_subcategory":"ingen","category":"Kategori","posts":"Inlägg","topics":"Diskussioner","latest":"Senaste","latest_by":"senast av","toggle_ordering":"slå av/på sorteringskontroll","subcategories":"Underkategorier:","topic_stats":"Antal nya trådar","topic_stat_sentence":{"one":"%{count} ny tråd under den senaste %{unit}.","other":"%{count} nya trådar under den senaste %{unit}."},"post_stats":"Antalet nya inlägg.","post_stat_sentence":{"one":"%{count} nytt inlägg under den senaste %{unit}.","other":"%{count} nya inlägg under den senaste %{unit}."}},"ip_lookup":{"title":"Kolla upp IP-adress","hostname":"Värdnamn","location":"Plats","location_not_found":"(okänd)","organisation":"Organisation","phone":"Telefon","other_accounts":"Andra konton med samma IP-adress","no_other_accounts":"(ingen)"},"user":{"said":"{{username}} sa:","profile":"Profil","mute":"Dämpa","edit":"Redigera inställningar","download_archive":"ladda ned ett arkiv med mina inlägg","private_message":"Privat meddelande","private_messages":"Meddelanden","activity_stream":"Aktivitet","preferences":"Inställningar","bookmarks":"Bokmärken","bio":"Om mig","invited_by":"Inbjuden Av","trust_level":"Förtroendenivå","notifications":"Notifieringar","disable_jump_reply":"Hoppa inte till ditt nya inlägg efter du svarat","dynamic_favicon":"Visa notifieringar om inkomna meddelanden på favicon (Experiment)","edit_history_public":"Låt andra användare se mina ändringar","external_links_in_new_tab":"Öppna alla externa länkar i en ny flik","enable_quoting":"Aktivera citatsvar för markerad text","change":"ändra","moderator":"{{user}} är en moderator","admin":"{{user}} är en admin","moderator_tooltip":"Den här användaren är moderator","admin_tooltip":"Den här användaren är administrator","suspended_notice":"Den här användaren är avstängd till {{date}}.","suspended_reason":"Anledning:","watched_categories":"Tittade på","watched_categories_instructions":"Du kommer automatiskt att följa alla nya trådar inom dessa kategorier. Du kommer att få notifieringar om alla nya inlägg och trådar; antalet olästa och nya inlägg kommer även att visas vid sidan av trådens namn.","tracked_categories":"Följd","tracked_categories_instructions":"Du kommer automatiskt att följa alla nya trådar inom dessa kategorier. Antalet olästa och nya inlägg kommer att visas vid sidan av trådens namn.","muted_categories":"Tystad","muted_categories_instructions":"Du kommer inte att få notifieringar om nya trådar inom dessa kategorier, och de kommer inte att visas under din \"oläst\"-tab.","delete_account":"Ta bort mitt konto","delete_account_confirm":"Är du säkert på att du vill ta bort ditt konto permanent? Denna åtgärd kan inte ångras!","deleted_yourself":"Ditt konto har framgångsrikt tagits bort.","delete_yourself_not_allowed":"Du kan inte ta bort ditt konto just nu. Kontakta en admin och be om att få ditt konto borttaget.","unread_message_count":"Meddelanden","staff_counters":{"flagged_posts":"flaggade inlägg","deleted_posts":"borttagna inlägg","suspensions":"avstängningar"},"messages":{"all":"Alla","mine":"Mina","unread":"Olästa"},"change_password":{"success":"(e-brev skickat)","in_progress":"(skickar e-brev)","error":"(fel)","action":"Skicka email för att återställa lösenord","set_password":"välj lösenord"},"change_about":{"title":"Ändra Om Mig"},"change_username":{"title":"Byt Användarnamn","confirm":"Det kan finnas konsekvenser till att byta ditt användarnamn. Är du helt säker på att du vill?","taken":"Tyvärr det användarnamnet är taget.","error":"Det uppstod ett problem under bytet av ditt användarnamn.","invalid":"Det användarnamnet är ogiltigt. Det får bara innehålla siffror och bokstäver"},"change_email":{"title":"Byt E-post","taken":"Tyvärr den adressen är inte tillgänglig.","error":"Det uppstod ett problem under bytet av din e-post. Är kanske adressen redan upptagen?","success":"Vi har skickat ett mail till den adressen. Var god följ bekräftelseinstruktionerna."},"change_avatar":{"title":"Ändra din avatar","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, baserat på","refresh_gravatar_title":"Uppdatera din Gravatar","letter_based":"Avatar tilldelad av systemet","uploaded_avatar":"Anpassad bild","uploaded_avatar_empty":"Lägg till en anpassad bild","upload_title":"Ladda upp din bild","upload_picture":"Ladda upp bild","image_is_not_a_square":"Varning: vi har beskurit din bild; den är inte kvadratisk."},"change_profile_background":{"title":"Profilbakgrund"},"email":{"title":"E-post","instructions":"Kommer aldrig visas offentligt","ok":"Ser bra ut. Vi kommer maila dig för att bekräfta.","invalid":"Vad god ange en giltig e-postadress.","authenticated":"Din e-post har autentiserats av {{provider}}.","frequency":"Vi kommer bara maila dig om vi inte har sett dig nyligen och du inte redan sett det vi mailar dig om."},"name":{"title":"Namn","instructions":"Fullständigt namn","too_short":"Ditt namn är för kort.","ok":"Ditt namn ser bra ut."},"username":{"title":"Användarnamn","instructions":"Måste vara unikt, kort och utan mellanslag.","short_instructions":"Personer kan omnämna dig som @{{username}}.","available":"Ditt användarnamn är tillgängligt.","global_match":"E-posten matchar det registrerade användarnamnet.","global_mismatch":"Redan registrerat. Prova {{suggestion}}?","not_available":"Inte tillgängligt. Prova {{suggestion}}?","too_short":"Ditt användarnamn är för kort.","too_long":"Ditt användarnamn är för långt.","checking":"Kollar användarnamnets tillgänglighet...","enter_email":"Användarnamn hittat. Ange matchande e-post.","prefilled":"Email matchar det registrerade användarnamnet."},"locale":{"title":"gränssnittsspråk","default":"(förvalt värde)"},"password_confirmation":{"title":"Lösenord Igen"},"last_posted":"Senaste inlägg","last_emailed":"Senast Mailad","last_seen":"Sedd","created":"Gick med","log_out":"Logga ut","location":"Plats","website":"Webbplats","email_settings":"E-post","email_digests":{"title":"När jag inte besöker sidan, skicka mig ett sammandrag via mail om vad som är nytt:","daily":"dagligen","weekly":"veckovis","bi_weekly":"varannan vecka"},"email_direct":"Ta emot ett mail när någon citerar dig, svarar på dina inlägg, eller nämner ditt @användarnamn","email_private_messages":"Ta emot ett mail när någon skickar dig ett privat meddelande","other_settings":"Övrigt","categories_settings":"Kategorier","new_topic_duration":{"label":"Betrakta trådar som nya när","not_viewed":"Du inte har tittat på dem än","last_here":"skapad sedan ditt senaste besök","after_n_days":{"one":"skapad det senaste dygnet","other":"skapad de senaste {{count}} dagarna"},"after_n_weeks":{"one":"skapad den senaste veckan","other":"skapad de senaste {{count}} veckorna"}},"auto_track_topics":"Följ automatiskt trådar du öppnar","auto_track_options":{"never":"aldrig","always":"alltid","after_n_seconds":{"one":"efter 1 sekund","other":"efter {{count}} sekunder"},"after_n_minutes":{"one":"efter 1 minut","other":"efter {{count}} minuter"}},"invited":{"search":"sök efter inbjudningar...","title":"Inbjudningar","user":"Inbjuden Användare","none":"Du har inte bjudit in någon här ännu.","truncated":"Visar de första {{count}} inbjudningarna.","redeemed":"Inlösta Inbjudnignar","redeemed_at":"Inlöst","pending":"Avvaktande Inbjudningar","topics_entered":"Besökta trådar","posts_read_count":"Inlägg Lästa","expired":"Denna inbjudan har gått ut.","rescind":"Ta bort","rescinded":"Inbjudan borttagen","time_read":"Lästid","days_visited":"Dagar Besökta","account_age_days":"Kontoålder i dagar","create":"Skicka en inbjudan","bulk_invite":{"none":"Du har inte skickat några inbjudningar. Du kan skicka individuella inbjudningar, eller så kan du bjuda in flera på en gång genom att \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003eladda upp en bulkfil.\u003c/a\u003e","text":"Massinbjudan från fil","uploading":"LADDAR UPP","success":"Uppladdning av filen lyckades","error":"Det blev ett fel vid uppladdning av '{{filename}}': {{message}}"}},"password":{"title":"Lösenord","too_short":"Ditt lösenord är för kort.","common":"Det lösenordet är för vanligt.","ok":"Ditt lösenord ser bra ut.","instructions":"Måste vara minst %{count} tecken lång."},"ip_address":{"title":"Senaste IP-adress"},"registration_ip_address":{"title":"IP-adress vid registrering"},"avatar":{"title":"Profilbild"},"title":{"title":"Titel"},"filters":{"all":"Alla"},"stream":{"posted_by":"Postat av","sent_by":"Skickat av","private_message":"privat meddelande","the_topic":"tråden"}},"loading":"Laddar...","errors":{"prev_page":"medan vi försökte ladda","reasons":{"network":"Nätverksfel","server":"Serverfel","forbidden":"Åtkomst nekad","unknown":"Fel"},"desc":{"network":"Vänligen kontrollera din uppkoppling.","network_fixed":"Ser ut som att den är tillbaka.","server":"Felmeddelande: {{status}}","unknown":"Något gick fel."},"buttons":{"back":"Gå tillbaka","again":"Försök igen","fixed":"Ladda sida"}},"close":"Stäng","assets_changed_confirm":"Den här siten uppdaterades precis. Ladda om för att se den senaste versionen?","read_only_mode":{"enabled":"En administratör har aktiverat läsläge. Du kan fortsätta kolla runt på sidan men kanske inte interagera med den.","login_disabled":"Det går inte att logga in medan siten är i skrivskyddat läge."},"learn_more":"lär dig mer...","year":"år","year_desc":"diskussioner skapade de senaste 365 dagarna","month":"månad","month_desc":"diskussioner skapade de senaste 30 dagarna","week":"vecka","week_desc":"diskussioner skapade de senaste 7 dagarna","day":"dag","first_post":"Första inlägget","mute":"Dämpa","unmute":"Avdämpa","last_post":"Sista inlägget","last_post_lowercase":"senaste inlägg","summary":{"description":"Det finns \u003cb\u003e{{count}}\u003c/b\u003e svar.","description_time":"Det finns \u003cb\u003e{{count}}\u003c/b\u003e svar med en uppskattad lästid på \u003cb\u003e{{readingTime}} minuter\u003c/b\u003e.","enable":"Sammanfatta denna tråd","disable":"Visa alla inlägg"},"deleted_filter":{"enabled_description":"Den här diskussionen innehåller borttagna inlägg som har dolts.","disabled_description":"Raderade inlägg i diskussionen visas.","enable":"Dölj raderade inlägg","disable":"Visa raderade inlägg"},"private_message_info":{"title":"Privat Konversation","invite":"Bjud In Andra...","remove_allowed_user":"Är du säker på att du vill ta bort {{name}} från det här privata meddelandet?"},"email":"E-post","username":"Användarnamn","last_seen":"Sedd","created":"Skapad","created_lowercase":"skapad","trust_level":"Förtroendenivå","search_hint":"användarnamn eller e-post","create_account":{"title":"Registrera nytt konto","failed":"Något gick fel, kanske är denna e-post redan registrerad, försök glömt lösenordslänken"},"forgot_password":{"title":"Glömt Lösenord","action":"Jag har glömt mitt lösenord","invite":"Skriv in ditt användarnamn eller e-postadress, så vi skickar dig ett mail om lösenordsåterställning.","reset":"Återställ Lösenord","complete_username":"Om ett konto matchar användarnamnet \u003cb\u003e%{username}\u003c/b\u003e bör du inom kort få ett e-postmeddelande med instruktioner för hur du återställer ditt lösenord.","complete_email":"Om ett konto matchar \u003cb\u003e%{email}\u003c/b\u003e bör du inom kort få ett e-postmeddelande med instruktioner för hur du återställer ditt lösenord."},"login":{"title":"Logga in","username":"Användare","password":"Lösenord","email_placeholder":"email eller användarnamn","caps_lock_warning":"Caps Lock är aktiverad","error":"Okänt fel","blank_username_or_password":"Vänligen ange din e-post eller användarnamn och lösenord.","reset_password":"Återställ Lösenord","logging_in":"Loggar in...","or":"Eller","authenticating":"Autentiserar...","awaiting_confirmation":"Ditt konto väntar på aktivering, använd glömt lösenordslänken för att skicka ett nytt aktiveringsmail.","awaiting_approval":"Ditt konto har inte godkänts av en moderator än. Du kommer att få ett mail när det är godkänt.","requires_invite":"Tyvärr, inbjudan krävs för tillgång till detta forum.","not_activated":"Du kan inte logga in än. Vi har tidigare skickat ett aktiveringsmail till dig via \u003cb\u003e{{sentTo}}\u003c/b\u003e. Var god följ instruktionerna i det mailet för att aktivera ditt konto.","resend_activation_email":"Klicka här för att skicka aktiveringsmailet igen.","sent_activation_email_again":"Vi har skickat ännu ett aktiveringsmail till dig via \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Det kan ta ett par minuter för det att komma fram; var noga med att kolla din skräppost.","google":{"title":"med Google","message":"Autentiserar med Google (kolla så att pop up-blockare inte är aktiverade)"},"google_oauth2":{"title":"med Google","message":"Autentiserar med Google (kolla så att pop up-blockare inte är aktiverade)"},"twitter":{"title":"med Twitter","message":"Autentiserar med Twitter (kolla så att pop up-blockare inte är aktiverade)"},"facebook":{"title":"med Facebook","message":"Autentiserar med Facebook (kolla så att pop up-blockare inte är aktiverade)"},"yahoo":{"title":"med Yahoo","message":"Autentiserar med Yahoo (kolla så att pop up-blockare inte är aktiverade)"},"github":{"title":"med GitHub","message":"Autentiserar med GitHub (kolla så att pop up-blockare inte är aktiverade)"}},"composer":{"posting_not_on_topic":"Du svarar på tråden \"{{title}}\", men du besöker just nu en annan tråd.","saving_draft_tip":"sparar","saved_draft_tip":"sparat","saved_local_draft_tip":"sparat lokalt","similar_topics":"Din tråd liknar...","drafts_offline":"utkast offline","min_length":{"need_more_for_title":"{{n}} tecken kvar för titeln","need_more_for_reply":"{{n}} tecken kvar för svaret"},"error":{"title_missing":"Du måste ange en rubrik","title_too_short":"Titeln måste vara minst {{min}} tecken lång.","title_too_long":"Titeln får inte vara längre än {{max}} tecken","post_missing":"Inlägg får inte vara tomma","post_length":"Inlägg måste vara minst {{min}} tecken långa.","category_missing":"Du måste välja en kategori"},"save_edit":"Spara Ändring","reply_original":"Svara på Ursprungstråd","reply_here":"Svara Här","reply":"Svara","cancel":"Avbryt","create_topic":"Skapa Tråd","create_pm":"Skapa Privat Meddelande","title":"eller tryck Ctrl+Enter","users_placeholder":"Lägg till en användare","title_placeholder":"Vad handlar denna diskussion om i en kort mening?","edit_reason_placeholder":"varför redigerar du?","show_edit_reason":"(lägg till anledningar för redigering)","reply_placeholder":"Skriv ditt svar här. Använd Markdown eller BBCode för formatering. Dra eller klista in en bild här för att ladda upp den.","view_new_post":"Visa ditt nya inlägg.","saving":"Sparar...","saved":"Sparat!","saved_draft":"Du har ett pågående inläggsutkast. Välj denna stapel för att fortsätta redigera.","uploading":"Laddar upp...","show_preview":"visa förhandsgranskning \u0026raquo;","hide_preview":"\u0026laquo; dölj förhandsgranskning","quote_post_title":"Citera hela inlägget","bold_title":"Fet","bold_text":"fet text","italic_title":"Kursiv","italic_text":"kursiv text","link_title":"Hyperlänk","link_description":"skriv en länkbeskrivning här","link_dialog_title":"Infoga Hyperlänk","link_optional_text":"valfri titel","quote_title":"Citat","quote_text":"Citat","code_title":"Förformaterad text","upload_title":"Bild","upload_description":"skriv en bildbeskrivning här","olist_title":"Numrerad Lista","ulist_title":"Punktlista","list_item":"Listobjekt","heading_title":"Rubrik","heading_text":"Rubrik","hr_title":"Horisontell linje","undo_title":"Ångra","redo_title":"Återställ","help":"Markdown Redigeringshjälp","toggler":"Dölj eller visa composer-panelen","admin_options_title":"Valfria personalinställningar för den här tråden","auto_close_label":"Tid för att automatiskt stänga tråden:","auto_close_units":"(# timmar, en tid, eller en timestamp)","auto_close_examples":"Ange en absolut tid eller antal timmar — 24, 17:00, 2013-11-22 14:00","auto_close_error":"Vänligen ange ett giltigt värde."},"notifications":{"title":"notifikationer med omnämnanden av @namn, svar på dina inlägg och trådar, privata meddelanden, etc","none":"Du har inte notifikationer just nu.","more":"visa äldre notifikationer","total_flagged":"totalt antal flaggade inlägg","mentioned":"\u003ci title='mentioned' class='icon'\u003e@\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='quoted' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='edited' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='accepted your invitation' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e accepterade din inbjudan\u003c/p\u003e","moved_post":"\u003ci title='moved post' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e flyttade {{description}}\u003c/p\u003e","linked":"\u003ci title='linked post' class='fa fa-arrow-left'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='badge granted' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eFötjänade '{{description}}'\u003c/p\u003e"},"upload_selector":{"title":"Lägg till en bild","title_with_attachments":"Lägg till en bild eller en fil","from_my_computer":"Från min enhet","from_the_web":"Från webben","remote_tip":"länk till bild http://example.com/image.jpg","remote_tip_with_attachments":"länk till bild eller fil http://example.com/file.ext (tillåtna filtyper: {{authorized_extensions}}).","local_tip":"klicka för att välja en bild från din enhet.","local_tip_with_attachments":"klicka för att välja en bild eller fil från din enhet (tillåtna filtyper: {{authorized_extensions}})","hint":"(du kan också dra \u0026 släppa in i redigeraren för att ladda upp dem)","hint_for_supported_browsers":"(du kan också dra och släppa eller klistra in bilder i redigeraren för att ladda upp dem)","uploading":"Laddar upp bild","image_link":"länk dit din bild ska peka"},"search":{"title":"sök efter trådar, inlägg, användare, eller kategorier","no_results":"Inga resultat hittades.","searching":"Söker ...","context":{"user":"Sök inlägg av @{{username}}","category":"Sök i kategorin \"{{category}}\"","topic":"Sök i denna diskussion"}},"site_map":"gå till en annan trådlista eller kategori","go_back":"gå tillbaka","not_logged_in_user":"användarsida med sammanställning av aktuell aktivitet och inställningar","current_user":"gå till din användarsida","starred":{"title":"stjärna","help":{"star":"stjärnmarkera denna tråd","unstar":"ta bort stjärnmarkering från denna tråd"}},"topics":{"bulk":{"reset_read":"Återställ Lästa","delete":"Ta bort diskussioner","dismiss_posts":"Avfärda inlägg","dismiss_posts_tooltip":"Nollställ räknaren för olästa i dessa diskussioner men fortsätt visa mig dem på min olästalista när nya inlägg har gjorts. ","dismiss_topics":"Avfärda Diskussioner","dismiss_topics_tooltip":"Sluta visa mig dessa diskussioner i min olästalista när nya inlägg har gjorts","dismiss_new":"Avfärda Nya","toggle":"toggla val av multipla trådar","actions":"Massändringar","change_category":"Ändra kategori","close_topics":"Stäng trådar","notification_level":"ändra notifieringsnivå","selected":{"one":"Du har markerat \u003cb\u003e1\u003c/b\u003e diskussion.","other":"Du har markerat \u003cb\u003e{{count}}\u003c/b\u003e diskussioner."}},"none":{"starred":"Du har inte stjärnmarkerat några trådar ännu. För att stjärnmarkera en tråd, klicka eller tryck på stjärnan brevid titeln.","unread":"Du har inga olästa trådar att läsa.","new":"Du har inga nya trådar att läsa.","read":"Du har inte läst några trådar än.","posted":"Du har inte postat i några trådar än.","latest":"Det finns inga senaste trådar. Det är lite sorgligt.","hot":"Det finns inga heta trådar.","category":"Det finns inga {{category}}-trådar.","top":"Det finns inga topptrådar.","educate":{"new":"\u003cp\u003eSom standard ses diskussioner som olästa när de startats de senaste 2 dagarna.\u003c/p\u003e\u003cp\u003eDu kan ändra detta i dina \u003ca href=\"%{userPrefsUrl}\"\u003einställningar\u003c/a\u003e.\u003c/p\u003e","unread":"\u003cp\u003eSom standard visas bara olästindikation för diskussioner som du har:\u003c/p\u003e\u003cul\u003e\u003cli\u003eStartat\u003c/li\u003e\u003cli\u003eSvarat på\u003c/li\u003e\u003cli\u003eLäst i mer än 4 minuter\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eEller om du uttryckligen har satt diskussionen.\u003c/p\u003e\u003cp\u003eYou can change this in your \u003ca href=\"%{userPrefsUrl}\"\u003epreferences\u003c/a\u003e.\u003c/p\u003e"}},"bottom":{"latest":"Det finns inga fler senaste trådar att läsa.","hot":"Det finns inga fler heta trådar att läsa.","posted":"Det finns inga fler postade trådar att läsa","read":"Det finns inga fler lästa trådar att läsa.","new":"Det finns inga fler nya trådar att läsa.","unread":"Det finns inga fler oläsa trådar att läsa.","starred":"Det finns inga fler stjärnmärkta trådar.","category":"Det finns inga fler {{category}}-trådar.","top":"Det finns inga fler topptrådar."}},"topic":{"filter_to":"{{post_count}} inlägg i tråd","create":"Skapa Tråd","create_long":"Skapa en nytt Tråd","private_message":"Starta en privat konversation","list":"Trådar","new":"ny tråd","unread":"oläst","new_topics":{"one":"1 ny tråd","other":"{{count}} nya trådar"},"unread_topics":{"one":"1 oläst tråd","other":"{{count}} olästa trådar"},"title":"Tråd","loading_more":"Laddar fler Trådar...","loading":"Laddar tråd...","invalid_access":{"title":"Tråden är privat","description":"Tyvärr, du har inte behörighet till den tråden.","login_required":"Du måste logga in för att se den här diskussionen."},"server_error":{"title":"Tråden misslyckades med att ladda","description":"Tyvärr, vi kunde inte ladda den tråden, troligen p.g.a. ett anslutningsproblem. Var go försök igen. Om problemet kvarstår, låt oss gärna veta det!"},"not_found":{"title":"Tråden hittades inte","description":"Tyvärr, vi kunde inte hitta den tråden. Kanske har den tagits bort av en moderator?"},"total_unread_posts":{"one":"du har 1 oläst inlägg i den här diskussionen","other":"du har {{count}} olästa inlägg i den här diskussionen"},"unread_posts":{"one":"du har 1 oläst gammalt inlägg i den här tråden","other":"du har {{count}} olästa gamla inlägg i den här tråden"},"new_posts":{"one":"det finns 1 nytt inlägg i den här tråden sedan du senast läste den","other":"det finns {{count}} nya inlägg i den här tråden sedan du senast läste den"},"likes":{"one":"det finns 1 gillning i den här tråden","other":"det finns {{count}} gillningar i den här tråden"},"back_to_list":"Tillbaka till Trådlistan","options":"Trådinställningar","show_links":"visa länkar som finns i den här tråden","toggle_information":"slå av/på tråddetaljer","read_more_in_category":"Vill du läsa mer? Bläddra bland andra trådar i {{catLink}} eller {{latestLink}}.","read_more":"Vill du läsa mer? {{catLink}} eller {{latestLink}}.","browse_all_categories":"Bläddra bland alla kategorier","view_latest_topics":"se de senaste trådarna","suggest_create_topic":"Varför inte skapa en tråd?","jump_reply_up":"hoppa till tidigare svar","jump_reply_down":"hoppa till senare svar","deleted":"Tråden har raderats","auto_close_notice":"Den här tråden kommer att stängas automatiskt %{timeLeft}.","auto_close_title":"Stäng Inställningar automatiskt","auto_close_save":"Spara","auto_close_remove":"Stäng inte den här tråden automatiskt","progress":{"title":"trådplacering","go_top":"toppen","go_bottom":"botten","go":"gå","jump_bottom_with_number":"hoppa till inlägg %{post_number}","total":"antal inlägg","current":"nuvarande inlägg","position":"inlägg %{current} av %{total}"},"notifications":{"reasons":{"3_6":"Du kommer att få notifikationer eftersom du bevakar denna kategori.","3_5":"Du kommer att få notifikationer eftersom du började följa den här tråden automatiskt.","3_2":"Du kommer ta emot notifikationer för att du kollar in denna tråd.","3_1":"Du kommer ta emot notifikationer för att du skapade denna tråd.","3":"Du kommer ta emot notifikationer för att du kollar in denna tråd.","2_8":"Du kommer att få notifikationer eftersom du följer denna kategori.","2_4":"Du kommer ta emot notifikationer för att du postade ett svar till denna tråd.","2_2":"Du kommer ta emot notifikationer för att du följer denna tråd.","2":"Du kommer ta emot notifikationer för att du \u003ca href=\"/users/{{username}}/preferences\"\u003eläser denna tråd\u003c/a\u003e.","1_2":"Du kommer bara meddelandes om någon nämner ditt @namn eller svara på dina inlägg.","1":"Du kommer bara meddelandes om någon nämner ditt @namn eller svara på dina inlägg.","0_7":"Du ignorerar alla notifikationer i den här kategorin.","0_2":"Du ignorerar alla notifikationer för denna tråd.","0":"Du ignorerar alla notifikationer för denna tråd."},"watching_pm":{"title":"följda","description":"Du kommer att få notifieringar om varje nytt inlägg i detta privata meddelande. Antalet olästa och nya inlägg kommer också att visas vid sidan av diskussionens namn."},"watching":{"title":"Kollar","description":"Du kommer att få notfieringar om varje nytt inlägg i denna diskussion. Antalet olästa och nya inlägg kommer också att visas vid sidan av diskussionens namn."},"tracking_pm":{"title":"bevakade","description":"Antal olästa och nya inlägg kommer visas bredvid det privata meddelandet. Du kommer enbart notifieras om någon nämner ditt @namn eller svarar på ditt inlägg."},"tracking":{"title":"Följer","description":"Antal olästa och nya inlägg kommer visas bredvid diskussionens namn. Du kommer enbart notifieras om någon nämner ditt @namn eller svarar på ditt inlägg."},"regular":{"title":"Vanlig","description":"Du kommer endast att få notifieringar om någon nämner ditt @namn eller svarar på ditt inlägg."},"regular_pm":{"title":"Vanlig(t)","description":"Du kommer bara notifieras om någon nämner ditt @namn eller svarar på ditt inlägg i det privata meddelandet."},"muted_pm":{"title":"tystade","description":"Du kommer aldrig att få notifieringar om något angående detta privatmeddelande."},"muted":{"title":"Dämpad","description":"Du kommer aldrig meddelas om denna tråd alls, och den kommer inte visas i din flik med olästa."}},"actions":{"recover":"Återställ tråd","delete":"Radera Tråd","open":"Öppna Tråd","close":"Stäng Tråd","auto_close":"Stäng Automatiskt","make_banner":"Banderollämne","remove_banner":"Radera Banderollämne","unpin":"Avnåla Tråd","pin":"Nåla Tråd","pin_globally":"Nåla diskussionen globalt","unarchive":"Dearkivera Tråd","archive":"Arkivera Tråd","invisible":"Gör Osynlig","visible":"Gör Synlig","reset_read":"Återställ Läsdata","multi_select":"Markera inlägg"},"reply":{"title":"Svara","help":"börja komponera ett svar till denna tråd"},"clear_pin":{"title":"Ta bort nål","help":"Ta bort den nålade statusen från denna tråd så den inte längre hamnar i toppen av din trådlista"},"share":{"title":"Dela","help":"dela en länk till denna tråd"},"flag_topic":{"title":"flagga","help":"flagga privat denna tråd för uppmärksamhet eller skicka en privat notifiering om den","success_message":"Du flaggade framgångsrikt denna tråd."},"inviting":"Bjuder in...","automatically_add_to_groups_optional":"Denna inbjudan inkluderar även tillgång till dessa grupper: (valfritt, enbart för administratörer)","automatically_add_to_groups_required":"Denna inbjudan inkluderar även tillgång till dessa grupper: (\u003cb\u003eKrävs\u003c/b\u003e, enbart för admninistörer)","invite_private":{"title":"Bjud in till Privat Konversation","email_or_username":"Den Inbjudnas E-post eller Användarnamn","email_or_username_placeholder":"e-postadress eller användarnamn","action":"Bjud In","success":"Vi har bjudit in den användaren att delta i det här privata meddelandet.","error":"Tyvärr det uppstod ett fel under inbjudandet av den användaren.","group_name":"gruppnamn"},"invite_reply":{"title":"Bjud in","action":"Email-inbjudan","help":"skicka inbjudningar till vänner så de kan svara i den här tråden med ett enda klick","to_topic":"Vi skickar ett kort e-postmeddelande som tillåter din vän att omedelbart delta och svara på den här diskussionen genom att klicka på en länka utan att logga in.","to_forum":"Vi skickar ett kort e-postmeddelande som tillåter din vän att omedelbart delta genom att klicka på en länk, ingen inloggning krävs.","email_placeholder":"namn@exampel.se","success":"Vi har mailat ut ett inbjudan till \u003cb\u003e{{email}}\u003c/b\u003e. Vi låter dig veta när de löst in sin inbjudan. Kolla in fliken med Inbjudningar på din användarsida för att hålla koll på vem du har bjudit in.","error":"Tyvärr vi kunde inte bjudan in den personen. Kanske är den redan en användare?"},"login_reply":"Logga in för att svara","filters":{"n_posts":{"one":"1 inlägg","other":"{{count}} inlägg"},"cancel":"Visa alla inlägg i den här tråden igen."},"split_topic":{"title":"Flytta till nyn tråd","action":"flytta till ny tråd","topic_name":"Namn på ny tråd","error":"Ett fel inträffade då inläggen skulle flyttas till den nya tråden.","instructions":{"one":"Du är påväg att skapa en ny tråd och lägga inlägget du har valt i den.","other":"Du är påväg att skapa en ny tråd och lägga de \u003cb\u003e{{count}}\u003c/b\u003e inlägg du har valt i den."}},"merge_topic":{"title":"Flytta till befintlig tråd","action":"flytta till befintlig tråd","error":"Ett fel inträffade då inlägg skulle flyttas till den tråden.","instructions":{"one":"Välj vilken tråd du vill flytta det inlägget till.","other":"Välj vilken tråd du vill flytta de \u003cbr\u003e{{count}}\u003c/b\u003e inläggen till."}},"change_owner":{"title":"Ändra ägare av inlägg","action":"ändra ägare","error":"Det blev något fel vid ändring av diskussionens ägarskap.","label":"Ny ägare av inlägg","placeholder":"användarnamn på den nya ägaren","instructions":{"one":"Vänligen välj ny ägare till inlägget av \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Vänligen välj ny ägare till de {{count}} inläggen av \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"Notera att inga notifieringar om detta inlägg kommer överföras till den nya användaren retroaktivt.\u003cbr\u003eVarning: Just nu överförs inga inläggskritiska data till den nya användaren. Använd med försiktighet. "},"multi_select":{"select":"markera","selected":"markerade ({{count}})","select_replies":"välj +svar","delete":"radera markerade","cancel":"avbryt markering","select_all":"markera alla","deselect_all":"avmarkera alla","description":{"one":"Du har markerat \u003cb\u003e1\u003c/b\u003e inlägg.","other":"Du har markerat \u003cb\u003e{{count}}\u003c/b\u003e inlägg."}}},"post":{"reply":"Svarar på {{link}} av {{replyAvatar}} {{username}}","reply_topic":"Svar på {{link}}","quote_reply":"citatsvar","edit":"Ändra {{link}} av {{replyAvatar}} {{username}}","edit_reason":"Anledning:","post_number":"inlägg {{number}}","in_reply_to":"svara till","last_edited_on":"inlägg senast ändrat den","reply_as_new_topic":"Svara som ny Tråd","continue_discussion":"Fortsätter diskussionen från {{postLink}}:","follow_quote":"gå till det citerade inlägget","show_full":"Via hela inlägget","show_hidden":"Visa dolt innehåll.","deleted_by_author":{"one":"(inlägg tillbakadraget av skaparen, kommer att raderas automatiskt om 1 timme om det inte flaggas)","other":"(inlägg tillbakadraget av skaparen, kommer att raderas automatiskt om %{count} timmar om det inte flaggas)"},"expand_collapse":"expandera/förminska","gap":{"one":"1 dolt inlägg","other":"{{count}} dolda inlägg"},"more_links":"{{count}} till...","unread":"Inlägget är oläst","has_replies":{"one":"Svara","other":"Svar"},"errors":{"create":"Tyvärr, det uppstod ett fel under skapandet av ditt inlägg. Var god försök igen.","edit":"Tyvärr, det uppstod ett fel under ändringen av ditt inlägg. Var god försök igen.","upload":"Tyvärr, det uppstod ett fel under uppladdandet av den filen. Vad god försök igen.","attachment_too_large":"Tyvärr, filen du försöker ladda upp är för stor (maximal storlek är {{max_size_kb}} kb).","image_too_large":"Tyvärr, filen som du försöker ladda upp är för stor (maxstorlek är {{max_size_kb}}kb), var god ändra storlek och försök igen.","too_many_uploads":"Tyvärr, du kan bara ladda upp en bild i taget.","upload_not_authorized":"Tyvärr, filen du försökte ladda upp är inte tillåten (tillåtna filtyper: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Tyvärr, nya användare kan inte ladda upp bilder.","attachment_upload_not_allowed_for_new_user":"Tyvärr, nya användare kan inte bifoga filer."},"abandon":{"confirm":"Är du säker på att du vill avbryta ditt inlägg?","no_value":"nej, behåll","yes_value":"Ja, överge"},"archetypes":{"save":"Spara Inställningar"},"controls":{"reply":"börja komponera ett svar till detta inlägg","like":"gilla detta inlägg","undo_like":"ångra like","edit":"ändra detta inlägg","flag":"flagga detta inlägg för uppmärksamhet privat eller skicka en privat påminnelse om det","delete":"radera detta inlägg","undelete":"återställ detta inlägg","share":"dela en länk till detta inlägg","more":"Mer","delete_replies":{"confirm":{"one":"Vill du radera det direkta svaret till det här inlägget också?","other":"Vill du radera de {{count}} direkta svaren på det här inlägget också?"},"yes_value":"Ja, radera även svaren","no_value":"Nej, bara det här inlägget"}},"actions":{"flag":"Flaga","it_too":{"off_topic":"Flagga det också","spam":"Flagga det också","inappropriate":"Flagga det också","custom_flag":"Flagga det också","bookmark":"Bokmärk det också","like":"Gilla det också","vote":"Rösta för det också"},"undo":{"off_topic":"Ångra flaggning","spam":"Ångra flaggning","inappropriate":"Ångra flaggning","bookmark":"Ångra bokmärkning","like":"Ångra gillning","vote":"Ångra röstning"},"people":{"notify_moderators":"{{icons}} notifierade moderatorer","notify_moderators_with_url":"{{icons}} \u003ca href='{{postUrl}}'\u003enotifierade moderatorer\u003c/a\u003e","notify_user":"{{icons}} skicka ett privat meddelande","notify_user_with_url":"{{icons}} skickade ett \u003ca href='{{postUrl}}'\u003eprivat meddelande\u003c/a\u003e","bookmark":"{{icons}} bokmärkte detta","like":"{{icons}} gillade detta","vote":"{{icons}} röstade för detta"},"by_you":{"off_topic":"Du flaggade detta som off-topic","spam":"Du flaggade detta som spam","inappropriate":"Du flaggade detta som olämpligt","notify_moderators":"Du flaggade det för moderation.","notify_user":"Du skickade ett privat meddelande till den här användaren.","bookmark":"Du bokmärkte detta inlägg","like":"Du gillade detta","vote":"Du röstade för detta inlägg"},"by_you_and_others":{"off_topic":{"one":"Du och 1 annan flaggade detta som off-topic","other":"Du och {{count}} andra personer flaggade detta som off-topic"},"spam":{"one":"Du och 1 annan flaggade detta som spam","other":"Du och {{count}} andra personer flaggade detta som spam"},"inappropriate":{"one":"Du och 1 annan flaggade detta som olämpligt","other":"Du och {{count}} andra personer flaggade detta som olämpligt"},"notify_moderators":{"one":"Du och 1 annan person har flaggat detta för moderation","other":"Du och {{count}} andra personer har flaggat detta för moderation"},"notify_user":{"one":"Du och 1 annan person har skickat ett privat meddelande till den här användaren","other":"Du och {{count}} andra personer har skickat ett privat meddelande till den här användaren"},"bookmark":{"one":"Du och 1 annan bokmärkte detta inlägg","other":"Du och {{count}} andra personer bokmärkte detta inlägg"},"like":{"one":"Du och 1 annan gillade detta","other":"Du och {{count}} andra personer gillade detta"},"vote":{"one":"Du och 1 annan röstade för detta inlägg","other":"Du och {{count}} andra personer röstade för detta inlägg"}},"by_others":{"off_topic":{"one":"1 person flaggade detta som off-topic","other":"{{count}} personer flaggade detta som off-topic"},"spam":{"one":"1 person flaggade detta som spam","other":"{{count}} personer flaggade detta som spam"},"inappropriate":{"one":"1 person flaggade detta som olämpligt","other":"{{count}} personer flaggade detta som olämpligt"},"notify_moderators":{"one":"1 person flaggade detta för granskning","other":"{{count}} personer flaggade detta för granskning"},"notify_user":{"one":"1 person skickade ett privat meddelande till den här användaren","other":"{{count}} skickade ett privat meddelande till den här användaren"},"bookmark":{"one":"1 person bokmärkte detta inlägg","other":"{{count}} personer bokmärkte detta inlägg"},"like":{"one":"1 person gillade detta","other":"{{count}} personer gillade detta"},"vote":{"one":"1 person röstade för detta inlägg","other":"{{count}} personer röstade för detta inlägg"}}},"edits":{"one":"1 ändring","other":"{{count}} ändringar","zero":"inga ändringar"},"delete":{"confirm":{"one":"Är du säker på att du vill radera detta inlägg?","other":"Är du säker på att du vill radera alla dessa inlägg?"}},"revisions":{"controls":{"first":"Första revision","previous":"Föregående revision","next":"Nästa revision","last":"Senaste revisionen","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e vs \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Visa resultat med tillägg och borttagningar inline","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Visa diffar för resultat sida vid sida","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Visa diffar för markdown-kod sida vid sida","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Markdown"}},"details":{"edited_by":"Ändrad av"}}},"category":{"can":"can\u0026hellip; ","none":"(ingen kategori)","choose":"Välj en kategori\u0026hellip;","edit":"ändra","edit_long":"Redigera","view":"Visa Trådar i Kategori","general":"Allmänt","settings":"Inställningar","delete":"Radera Kategori","create":"Skapa Kategori","save":"Spara kategori","creation_error":"Det uppstod ett fel när kategorin skulle skapas.","save_error":"Ett fel inträffade då kategorin skulle sparas.","name":"Kategorinamn","description":"Beskrivning","topic":"Kategoritråd","badge_colors":"Emblemsfärg","background_color":"Bakgrundsfärg","foreground_color":"Förgrundsfärg","name_placeholder":"Ett eller två ord max","color_placeholder":"Någon webbfärg","delete_confirm":"Är du säker på att du vill radera den kategorin?","delete_error":"Ett fel inträffade vid borttagning av kategorin.","list":"Lista Kategorier","change_in_category_topic":"besök kategorins tråd för att ändra beskrivning","already_used":"Den här färgen används redan av en annan kategori","security":"Säkerhet","images":"Bilder","auto_close_label":"Stäng automatiskt tråden efter:","auto_close_units":"timmar","edit_permissions":"Redigera behörigheter","add_permission":"Lägg till behörighet","this_year":"i år","position":"position","default_position":"Standardposition","parent":"Förälderkategori","notifications":{"tracking":{"title":"Följer","description":"Du kommer automatiskt att följa alla nya trådar inom dessa kategorier. Antalet olästa och nya inlägg kommer att visas vid sidan av trådens namn."}}},"flagging":{"title":"Varför flaggar du detta inlägg privat?","action":"Flagga Inlägg","take_action":"Åtgärda","notify_action":"Privat meddelande","delete_spammer":"Radera spammare","delete_confirm":"Du håller på att radera \u003cb\u003e%{posts}\u003c/b\u003e inlägg och \u003cb\u003e%{topics}\u003c/b\u003e trådar från den här användaren, radera hans/hennes konto, blockera IP-adressen \u003cb\u003e%{ip_address}\u003c/b\u003e, och lägga till email-adressen \u003cb\u003e%{email}\u003c/b\u003e till en permanent blockeringslista. Är du säker på att den här användaren verkligen är en spammare?","yes_delete_spammer":"Ja, radera spammare","cant":"Tyvärr, du kan inte flagga detta inlägg just nu.","custom_placeholder_notify_user":"Varför gör det här inlägget att du behöver tala direkt och privat med den här användaren? Var specifik, var konstruktiv, och var alltid vänlig.","custom_placeholder_notify_moderators":"Varför kräver detta inlägg uppmärksamhet från en moderator? Låt oss veta specifikt vad det gäller, med relevanta länkar där det är möjligt.","custom_message":{"at_least":"skriv åtminstone {{n}} tecken","more":"{{n}} fler...","left":"{{n}} kvar"}},"flagging_topic":{"title":"Varför flaggar du privat denna tråd?","action":"Flagga tråd","notify_action":"Privatmeddelande"},"topic_map":{"title":"Sammanfattning av tråd","links_shown":"visa alla {{totalLinks}} länkar..."},"posts":"Inlägg","posts_long":"{{number}} inlägg i den här tråden","original_post":"Originalinlägg","views":"Visningar","replies":"Svar","views_long":"denna tråd har visats {{number}} gånger","activity":"Aktivitet","likes":"Gillningar","likes_long":"det finns {{number}} gillningar i den här tråden","users":"Användare","category_title":"Kategori","history":"Historik","changed_by":"av {{author}}","categories_list":"Kategorilista","filters":{"latest":{"title":"Senaste","help":"Trådar med nya inlägg"},"hot":{"title":"Hett","help":"ett urval av de hetaste trådarna"},"starred":{"title":"Stjärnmärkt","help":"trådar du stjärnmärkt"},"read":{"title":"Lästa","help":"trådar du har läst, i den ordningen du senast läste dem"},"categories":{"title":"Kategorier","title_in":"Kategori - {{categoryName}}","help":"alla trådar grupperade efter kategori"},"unread":{"title":{"zero":"Olästa","one":"Olästa (1)","other":"Olästa ({{count}})"},"help":"Trådar du tittar på eller följer med olästa inlägg"},"new":{"lower_title_with_count":{"one":"1 ny","other":"{{count}} nya"},"title":{"zero":"Nya","one":"Nya (1)","other":"Nya ({{count}})"}},"posted":{"title":"Mina Inlägg","help":"trådar som du har postat i"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"senaste trådarna i {{categoryName}}-kategorin"},"top":{"title":"Topp","yearly":{"title":"Topp i år"},"monthly":{"title":"Topp denna månad"},"weekly":{"title":"Topp denna vecka"},"daily":{"title":"Topp idag"},"this_year":"I år","this_month":"Den här månaden","this_week":"Den här veckan","today":"Idag","other_periods":"se fler topptrådar"}},"permission_types":{"full":"Skapa / svara / se","create_post":"Svara / se","readonly":"se"},"type_to_filter":"skriv för att filtrera...","admin":{"title":"Discourse Admin","moderator":"Moderator","dashboard":{"title":"Översiktspanel","last_updated":"Dashboard senast uppdaterad:","version":"Version","up_to_date":"Du är aktuell!","critical_available":"En kritisk uppdatering är tillgänglig.","updates_available":"Uppdateringar är tillgängliga.","please_upgrade":"Var god uppgradera!","no_check_performed":"En sökning efter uppdateringar har ej genomförts. Kontrollera att sidekiq körs.","stale_data":"En sökning efter uppdateringar har inte genomförts på sistone. Kontrollera att sidekiq körs.","version_check_pending":"Det verkar som att du har uppgraderat nyligen. Utmärkt!","installed_version":"Installerad","latest_version":"Senaste","problems_found":"Några problem har hittas med din installation av Discourse:","last_checked":"Senast kollad","refresh_problems":"Uppdatera","no_problems":"Inga problem upptäcktes.","moderators":"Moderatorer:","admins":"Administratörer:","blocked":"Blockerad:","suspended":"Avstängd:","private_messages_short":"PMs","private_messages_title":"Privata meddelanden","reports":{"today":"Idag","yesterday":"Igår","last_7_days":"De senaste 7 dagarna","last_30_days":"De senaste 30 dagarna","all_time":"Alltid","7_days_ago":"7 dagar sedan","30_days_ago":"30 dagar sedan","all":"Alla","view_table":"Visa som tabell","view_chart":"Visa som stapeldiagram"}},"commits":{"latest_changes":"Senaste ändringarna: snälla uppdatera ofta!","by":"av"},"flags":{"title":"Flaggningar","old":"Gamla","active":"Aktiva","clear_topic_flags":"Klar","clear_topic_flags_title":"Tråden har undersökts och eventuella problem har lösts. Klicka på klar för att ta bort flaggorna.","flagged_by":"Flaggad av","system":"System","error":"Någonting gick snett","no_results":"Det finns inga flaggor.","topic_flagged":"Denna \u003cstrong\u003etråd\u003c/strong\u003e har blivit flaggad.","summary":{"action_type_3":{"one":"off-topic","other":"off-topic x{{count}}"},"action_type_4":{"one":"olämpligt","other":"olämpligt x{{count}}"},"action_type_6":{"one":"custom","other":"custom x{{count}}"},"action_type_7":{"one":"anpassad","other":"anpassad x{{count}}"},"action_type_8":{"one":"spam","other":"spam x{{count}}"}}},"groups":{"primary":"primär grpp","no_primary":"(ingen primär grupp)","title":"Groups","edit":"Edit Groups","refresh":"uppdatera","selector_placeholder":"add users","name_placeholder":"Group name, no spaces, same as username rule","about":"Edit your group membership and names here","delete":"Radera","delete_confirm":"Delete this group?","delete_failed":"Unable to delete group. If this is an automatic group, it cannot be destroyed."},"api":{"generate_master":"Generera API-huvudnyckel","none":"Det finns inga aktiva API-nycklar just nu.","user":"Användare","title":"API","key":"API-nyckel","generate":"Generera","regenerate":"Regenerera","revoke":"Återkalla","confirm_regen":"Är du säker på att du vill ersätta den API-nyckeln med en ny?","confirm_revoke":"Är du säker på att du vill återkalla den nyckeln?","info_html":"Your API key will allow you to create and update topics using JSON calls.","all_users":"Alla användare"},"backups":{"title":"säkerhetskopior","menu":{"backups":"säkerhetskopior","logs":"loggar"},"none":"Ingen säkerhetskopia är tillgänglig.","columns":{"filename":"filnamn","size":"storlek"},"operations":{"cancel":{"text":"avbryt"},"backup":{"text":"säkerhetskopia","title":"skapa en säkerhetskopia"},"download":{"text":"ladda ned","title":"ladda ned säkerhetskopian"},"destroy":{"text":"radera","title":"Ta bort säkerhetskopian","confirm":"Är du säker på att du vill förstöra denna säkerhetskopia?"},"restore":{"is_disabled":"Återställ är inaktiverat i sidans inställningar.","text":"återställ","title":"återställ säkerhetskopian","confirm":"Är du säker på att du vill återställa denna säkerhetskopia?"},"rollback":{"text":"rollback","title":"Gör rollback på databasen till ett tidigare fungerande tillstånd.","confirm":"Är du säker på att du vill göra rollback på databasen till det tidigare fungerande tillståndet?"}}},"customize":{"title":"Anpassa","long_title":"Sidanpassningar","header":"Sidhuvud","css":"Stilmall","mobile_header":"Mobil-header","mobile_css":"Mobil-stylesheet","override_default":"Skriv över standard?","enabled":"Aktiverad?","preview":"förhandsgranska","save":"Spara","new":"Ny","new_style":"Ny Stil","delete":"Radera","delete_confirm":"Radera denna anpassning?"},"email":{"title":"E-postloggar","settings":"Inställningar","all":"alla","sending_test":"Skickar testmail...","sent":"skickade","skipped":"överhoppade","sent_at":"Skickat","time":"tid","user":"Användare","email_type":"E-posttyp","to_address":"Till adress","test_email_address":"e-postadress att testa","sent_test":"skickat!","delivery_method":"Leveransmetod","preview_digest":"Sammandrag","preview_digest_desc":"Detta är ett verktyg för att förhandsgranska innehållet i email-sammandragen som skickas från ditt forum.","refresh":"Uppdatera","format":"Format","html":"html","text":"text","last_seen_user":"Senast sedd användare:","reply_key":"Svarsnyckel","skipped_reason":"anledning för överhoppning","logs":{"none":"Inga loggar funna.","filters":{"title":"filter","user_placeholder":"användarnamn","skipped_reason_placeholder":"anledning"}}},"logs":{"title":"Loggar","action":"Åtgärd","created_at":"Skapad","last_match_at":"Senast matchad","match_count":"Träffar","ip_address":"IP","delete":"Radera","edit":"Redigera","save":"Spara","screened_actions":{"block":"blockera","do_nothing":"gör ingenting"},"staff_actions":{"title":"Personalåtgärder","instructions":"Klicka på användarnamn och åtgärder för att filtrera listan. Klicka på avatarer för att gå till användarsidor.","clear_filters":"Visa allt","staff_user":"Personalmedlem","target_user":"Målanvändare","subject":"Ämne","when":"När","context":"Sammanhang","details":"Detaljer","previous_value":"Föregående","new_value":"Ny","diff":"Diff","show":"Visa","modal_title":"Detaljer","no_previous":"Det finns inget tidigare värde.","deleted":"Inget nytt värde. Registreringen raderades.","actions":{"delete_user":"radera användare","change_trust_level":"Ändra förtroendenivå","change_site_setting":"ändra sidinställning","change_site_customization":"ändra webbplatsanpassning","delete_site_customization":"radera webbplatsanpassning","suspend_user":"Stäng av användare","unsuspend_user":"Ej avstängd användare"}},"screened_emails":{"title":"Kontrollerade email","description":"När någon försöker skapa ett nytt konto, kommer följande emailadresser att kontrolleras och registrationen blockeras, eller någon annan åtgärd vidtas.","email":"Emailadress"},"screened_urls":{"title":"Granskade URL:er","description":"URL:erna som är listade här har använts i inlägg av användare som är identifierade som spammare.","url":"URL","domain":"Domän"},"screened_ips":{"title":"Granskade IP-adresser","description":"IP-adresser som är under bevakning. Använd \"tillåt\" för att vitlista IP-adresser.","delete_confirm":"Är du säker på att du vill ta bort regeln för %{ip_address}?","actions":{"block":"Blockera","do_nothing":"Tillåt"},"form":{"label":"Nytt:","ip_address":"IP-adress","add":"Lägg till"}}},"users":{"title":"Användare","create":"Lägg till Administratör","last_emailed":"Senast Mailad","not_found":"Tyvärr den användaren existerar inte i vårt system.","active":"Aktiv","nav":{"new":"Ny","active":"Aktiv","pending":"Avvaktande","admins":"Admins","moderators":"Mods","suspended":"Avstängd","blocked":"Blockerad"},"approved":"Godkänd?","approved_selected":{"one":"godkänd användare","other":"godkänd användare ({{count}})"},"reject_selected":{"one":"avvisad användare","other":"avvisade användare ({{count}})"},"titles":{"active":"Aktiva användare","new":"Nya användare","pending":"Användare under granskning","newuser":"Användare på Förtroendenivå 0 (ny användare)","basic":"Användare på Förtroendenivå 1 (grundnivå)","regular":"Användare på Förtroendenivå 2 (normal användare)","elder":"Användare på förtroendenivå 4 (vördig)","admins":"Admin-användare","moderators":"Moderatorer","blocked":"Blockerade användare","suspended":"Avstängda användare"},"reject_successful":{"one":"1 användare har avvisats.","other":"%{count} användare har avvisats."},"reject_failures":{"one":"Avvisning av användaren misslyckades.","other":"Avvisning av %{count} användare misslyckades."}},"user":{"suspend_failed":"Någonting gick fel under avstängningen av denna användare {{error}}","unsuspend_failed":"Någonting gick fel under upplåsningen av denna användare {{error}}","suspend_duration":"Hur länge ska användaren vara avstängd?","suspend_duration_units":"(dagar)","suspend_reason_label":"Varför stänger du av användaren? Denna text \u003cb\u003ekommer att vara synlig för alla\u003c/b\u003e på användarens profilsida, och kommer att visas för användaren när han/hon försöker logga in. Håll den kort.","suspend_reason":"Anledning","suspended_by":"Avstängd av","delete_all_posts":"Radera alla inlägg","delete_all_posts_confirm":"Du är påväg att radera %{posts} inlägg och %{topics} trådar. Är du säker?","suspend":"Stäng av användare","unsuspend":"Lås upp användare","suspended":"Avstängd?","moderator":"Moderator?","admin":"Administratör?","blocked":"Blockerad?","show_admin_profile":"Administratör","edit_title":"Redigera titel","save_title":"Spara titel","refresh_browsers":"Tvinga webbläsaruppdatering","show_public_profile":"Visa Publik Profil","impersonate":"Imitera","revoke_admin":"Återkalla Administratör","grant_admin":"Bevilja Administratör","revoke_moderation":"Återkalla Moderering","grant_moderation":"Bevilja Moderering","unblock":"Avblockera","block":"Blockera","reputation":"Rykte","permissions":"Rättigheter","activity":"Aktivitet","private_topics_count":"Antal Privata Trådar","posts_read_count":"Inlägg Lästa","post_count":"Inlägg Skapade","topics_entered":"Besökta trådar","flags_given_count":"Givna Flaggnignar","flags_received_count":"Mottagna Flaggningar","approve":"Godkänn","approved_by":"godkänd av","approve_success":"Användaren är godkänd och ett email kommer att skickas med aktiveringsinstruktioner.","approve_bulk_success":"OK! Alla valda användare har godkänts och meddelats.","time_read":"Lästid","delete":"Radera användare","delete_forbidden_because_staff":"Admins och moderatorer kan inte tas bort.","delete_forbidden":{"one":"Användare kan inte tas bort om de har inlägg. Radera alla inlägg innan du försöker ta bort en användare. (Inlägg som är äldre än %{count} dag kan ej raderas.)","other":"Användare kan inte tas bort om de har inlägg. Radera alla inlägg innan du försöker ta bort en användare. (Inlägg som är äldre än %{count} dagar kan ej raderas.)"},"deleted":"Användaren har raderats.","delete_failed":"Ett problem uppstod då användaren skulle raderas. Kontrollera att alla inlägg är borttagna innan du försöker radera användaren.","send_activation_email":"Skicka aktiveringsmail","activation_email_sent":"Ett aktiveringsmail har skickats.","send_activation_email_failed":"Ett problem uppstod då ett nytt aktiveringsemail skulle skickas. %{error}","activate":"Aktivera Konto","activate_failed":"Ett problem uppstod då användaren skulle aktiveras.","deactivate_account":"Avaktivera Konto","deactivate_failed":"Det uppkom ett problem vid avaktiveringen av användaren.","unblock_failed":"Ett problem uppstod då användare skulle avblockeras.","block_failed":"Ett problem uppstod då användaren skulle blockeras.","deactivate_explanation":"En avaktiverad användare måste bekräfta sin emailadress igen.","suspended_explanation":"En avstängd användare kan inte logga in.","block_explanation":"En blockerad användare kan inte posta inlägg eller starta trådar.","trust_level_change_failed":"Ett problem uppstod då användarens förtroendenivå skulle ändras.","suspend_modal_title":"Stäng av användare","trust_level_2_users":"Användare med Förtroendenivå 2","trust_level_3_requirements":"Krav för Förtroendenivå 3","tl3_requirements":{"title":"Krav för Förtroendenivå 3","table_title":"Under de senaste 100 dagarna:","value_heading":"värde","requirement_heading":"krav","visits":"besök","days":"dagar","topics_replied_to":"Trådar svarade på","flagged_posts":"flaggade inlägg"}},"site_content":{"none":"Välj typ av innehåll för att börja ändra.","title":"Sidinnehåll","edit":"Ändra sidinnehåll"},"site_settings":{"show_overriden":"Visa bara överskrivna","title":"Webbplatsinställningar","none":"inget","no_results":"Inga resultat hittades.","clear_filter":"Rensa","categories":{"all_results":"Alla","required":"Krävs","basic":"Grundläggande setup","users":"Användare","posting":"Posta inlägg","email":"Email","files":"Filer","trust":"Förtroendenivå","security":"Säkerhet","seo":"SEO","spam":"Spam","rate_limits":"Begränsningar","developer":"Utvecklare","embedding":"Inbäddning"}},"badges":{"description":"beskrivning","save":"spara","delete":"ta bort"}},"lightbox":{"download":"ladda ned"},"keyboard_shortcuts_help":{"jump_to":{"title":"Hoppa till"},"navigation":{"title":"Navigering","back":"Tillbaka","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e flytta markering upp/ned","open":"\u003cb\u003eö\u003c/b\u003e eller \u003cb\u003eVälj\u003c/b\u003e Öppna vald tråd"},"application":{"create":"\u003cb\u003es\u003c/b\u003e Skapa en ny tråd","notifications":"\u003cb\u003en\u003c/b\u003e Öppna notifikationer","search":"Sök","help":"\u003cb\u003e?\u003c/b\u003e öppna hjälp för kortkommandon"},"actions":{"star":"\u003cb\u003ef\u003c/b\u003e stjärnmärk tråd","like":"Gilla inlägg","flag":"\u003cb\u003e!\u003c/b\u003e flagga inlägg","bookmark":"\u003cb\u003eb\u003c/b\u003e bokmärk inlägg","edit":"\u003cb\u003ee\u003c/b\u003e redigera inlägg","delete":"\u003cb\u003ed\u003c/b\u003e radera inlägg","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Följd diskussion"}}}}};
I18n.locale = 'sv';
//! moment.js
//! version : 2.8.1
//! authors : Tim Wood, Iskren Chernev, Moment.js contributors
//! license : MIT
//! momentjs.com

(function (undefined) {
    /************************************
        Constants
    ************************************/

    var moment,
        VERSION = '2.8.1',
        // the global-scope this is NOT the global object in Node.js
        globalScope = typeof global !== 'undefined' ? global : this,
        oldGlobalMoment,
        round = Math.round,
        i,

        YEAR = 0,
        MONTH = 1,
        DATE = 2,
        HOUR = 3,
        MINUTE = 4,
        SECOND = 5,
        MILLISECOND = 6,

        // internal storage for locale config files
        locales = {},

        // extra moment internal properties (plugins register props here)
        momentProperties = [],

        // check for nodeJS
        hasModule = (typeof module !== 'undefined' && module.exports),

        // ASP.NET json date format regex
        aspNetJsonRegex = /^\/?Date\((\-?\d+)/i,
        aspNetTimeSpanJsonRegex = /(\-)?(?:(\d*)\.)?(\d+)\:(\d+)(?:\:(\d+)\.?(\d{3})?)?/,

        // from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
        // somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
        isoDurationRegex = /^(-)?P(?:(?:([0-9,.]*)Y)?(?:([0-9,.]*)M)?(?:([0-9,.]*)D)?(?:T(?:([0-9,.]*)H)?(?:([0-9,.]*)M)?(?:([0-9,.]*)S)?)?|([0-9,.]*)W)$/,

        // format tokens
        formattingTokens = /(\[[^\[]*\])|(\\)?(Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Q|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|mm?|ss?|S{1,4}|X|zz?|ZZ?|.)/g,
        localFormattingTokens = /(\[[^\[]*\])|(\\)?(LT|LL?L?L?|l{1,4})/g,

        // parsing token regexes
        parseTokenOneOrTwoDigits = /\d\d?/, // 0 - 99
        parseTokenOneToThreeDigits = /\d{1,3}/, // 0 - 999
        parseTokenOneToFourDigits = /\d{1,4}/, // 0 - 9999
        parseTokenOneToSixDigits = /[+\-]?\d{1,6}/, // -999,999 - 999,999
        parseTokenDigits = /\d+/, // nonzero number of digits
        parseTokenWord = /[0-9]*['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+|[\u0600-\u06FF\/]+(\s*?[\u0600-\u06FF]+){1,2}/i, // any word (or two) characters or numbers including two/three word month in arabic.
        parseTokenTimezone = /Z|[\+\-]\d\d:?\d\d/gi, // +00:00 -00:00 +0000 -0000 or Z
        parseTokenT = /T/i, // T (ISO separator)
        parseTokenTimestampMs = /[\+\-]?\d+(\.\d{1,3})?/, // 123456789 123456789.123
        parseTokenOrdinal = /\d{1,2}/,

        //strict parsing regexes
        parseTokenOneDigit = /\d/, // 0 - 9
        parseTokenTwoDigits = /\d\d/, // 00 - 99
        parseTokenThreeDigits = /\d{3}/, // 000 - 999
        parseTokenFourDigits = /\d{4}/, // 0000 - 9999
        parseTokenSixDigits = /[+-]?\d{6}/, // -999,999 - 999,999
        parseTokenSignedNumber = /[+-]?\d+/, // -inf - inf

        // iso 8601 regex
        // 0000-00-00 0000-W00 or 0000-W00-0 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000 or +00)
        isoRegex = /^\s*(?:[+-]\d{6}|\d{4})-(?:(\d\d-\d\d)|(W\d\d$)|(W\d\d-\d)|(\d\d\d))((T| )(\d\d(:\d\d(:\d\d(\.\d+)?)?)?)?([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/,

        isoFormat = 'YYYY-MM-DDTHH:mm:ssZ',

        isoDates = [
            ['YYYYYY-MM-DD', /[+-]\d{6}-\d{2}-\d{2}/],
            ['YYYY-MM-DD', /\d{4}-\d{2}-\d{2}/],
            ['GGGG-[W]WW-E', /\d{4}-W\d{2}-\d/],
            ['GGGG-[W]WW', /\d{4}-W\d{2}/],
            ['YYYY-DDD', /\d{4}-\d{3}/]
        ],

        // iso time formats and regexes
        isoTimes = [
            ['HH:mm:ss.SSSS', /(T| )\d\d:\d\d:\d\d\.\d+/],
            ['HH:mm:ss', /(T| )\d\d:\d\d:\d\d/],
            ['HH:mm', /(T| )\d\d:\d\d/],
            ['HH', /(T| )\d\d/]
        ],

        // timezone chunker "+10:00" > ["10", "00"] or "-1530" > ["-15", "30"]
        parseTimezoneChunker = /([\+\-]|\d\d)/gi,

        // getter and setter names
        proxyGettersAndSetters = 'Date|Hours|Minutes|Seconds|Milliseconds'.split('|'),
        unitMillisecondFactors = {
            'Milliseconds' : 1,
            'Seconds' : 1e3,
            'Minutes' : 6e4,
            'Hours' : 36e5,
            'Days' : 864e5,
            'Months' : 2592e6,
            'Years' : 31536e6
        },

        unitAliases = {
            ms : 'millisecond',
            s : 'second',
            m : 'minute',
            h : 'hour',
            d : 'day',
            D : 'date',
            w : 'week',
            W : 'isoWeek',
            M : 'month',
            Q : 'quarter',
            y : 'year',
            DDD : 'dayOfYear',
            e : 'weekday',
            E : 'isoWeekday',
            gg: 'weekYear',
            GG: 'isoWeekYear'
        },

        camelFunctions = {
            dayofyear : 'dayOfYear',
            isoweekday : 'isoWeekday',
            isoweek : 'isoWeek',
            weekyear : 'weekYear',
            isoweekyear : 'isoWeekYear'
        },

        // format function strings
        formatFunctions = {},

        // default relative time thresholds
        relativeTimeThresholds = {
            s: 45,  // seconds to minute
            m: 45,  // minutes to hour
            h: 22,  // hours to day
            d: 26,  // days to month
            M: 11   // months to year
        },

        // tokens to ordinalize and pad
        ordinalizeTokens = 'DDD w W M D d'.split(' '),
        paddedTokens = 'M D H h m s w W'.split(' '),

        formatTokenFunctions = {
            M    : function () {
                return this.month() + 1;
            },
            MMM  : function (format) {
                return this.localeData().monthsShort(this, format);
            },
            MMMM : function (format) {
                return this.localeData().months(this, format);
            },
            D    : function () {
                return this.date();
            },
            DDD  : function () {
                return this.dayOfYear();
            },
            d    : function () {
                return this.day();
            },
            dd   : function (format) {
                return this.localeData().weekdaysMin(this, format);
            },
            ddd  : function (format) {
                return this.localeData().weekdaysShort(this, format);
            },
            dddd : function (format) {
                return this.localeData().weekdays(this, format);
            },
            w    : function () {
                return this.week();
            },
            W    : function () {
                return this.isoWeek();
            },
            YY   : function () {
                return leftZeroFill(this.year() % 100, 2);
            },
            YYYY : function () {
                return leftZeroFill(this.year(), 4);
            },
            YYYYY : function () {
                return leftZeroFill(this.year(), 5);
            },
            YYYYYY : function () {
                var y = this.year(), sign = y >= 0 ? '+' : '-';
                return sign + leftZeroFill(Math.abs(y), 6);
            },
            gg   : function () {
                return leftZeroFill(this.weekYear() % 100, 2);
            },
            gggg : function () {
                return leftZeroFill(this.weekYear(), 4);
            },
            ggggg : function () {
                return leftZeroFill(this.weekYear(), 5);
            },
            GG   : function () {
                return leftZeroFill(this.isoWeekYear() % 100, 2);
            },
            GGGG : function () {
                return leftZeroFill(this.isoWeekYear(), 4);
            },
            GGGGG : function () {
                return leftZeroFill(this.isoWeekYear(), 5);
            },
            e : function () {
                return this.weekday();
            },
            E : function () {
                return this.isoWeekday();
            },
            a    : function () {
                return this.localeData().meridiem(this.hours(), this.minutes(), true);
            },
            A    : function () {
                return this.localeData().meridiem(this.hours(), this.minutes(), false);
            },
            H    : function () {
                return this.hours();
            },
            h    : function () {
                return this.hours() % 12 || 12;
            },
            m    : function () {
                return this.minutes();
            },
            s    : function () {
                return this.seconds();
            },
            S    : function () {
                return toInt(this.milliseconds() / 100);
            },
            SS   : function () {
                return leftZeroFill(toInt(this.milliseconds() / 10), 2);
            },
            SSS  : function () {
                return leftZeroFill(this.milliseconds(), 3);
            },
            SSSS : function () {
                return leftZeroFill(this.milliseconds(), 3);
            },
            Z    : function () {
                var a = -this.zone(),
                    b = '+';
                if (a < 0) {
                    a = -a;
                    b = '-';
                }
                return b + leftZeroFill(toInt(a / 60), 2) + ':' + leftZeroFill(toInt(a) % 60, 2);
            },
            ZZ   : function () {
                var a = -this.zone(),
                    b = '+';
                if (a < 0) {
                    a = -a;
                    b = '-';
                }
                return b + leftZeroFill(toInt(a / 60), 2) + leftZeroFill(toInt(a) % 60, 2);
            },
            z : function () {
                return this.zoneAbbr();
            },
            zz : function () {
                return this.zoneName();
            },
            X    : function () {
                return this.unix();
            },
            Q : function () {
                return this.quarter();
            }
        },

        deprecations = {},

        lists = ['months', 'monthsShort', 'weekdays', 'weekdaysShort', 'weekdaysMin'];

    // Pick the first defined of two or three arguments. dfl comes from
    // default.
    function dfl(a, b, c) {
        switch (arguments.length) {
            case 2: return a != null ? a : b;
            case 3: return a != null ? a : b != null ? b : c;
            default: throw new Error('Implement me');
        }
    }

    function defaultParsingFlags() {
        // We need to deep clone this object, and es5 standard is not very
        // helpful.
        return {
            empty : false,
            unusedTokens : [],
            unusedInput : [],
            overflow : -2,
            charsLeftOver : 0,
            nullInput : false,
            invalidMonth : null,
            invalidFormat : false,
            userInvalidated : false,
            iso: false
        };
    }

    function printMsg(msg) {
        if (moment.suppressDeprecationWarnings === false &&
                typeof console !== 'undefined' && console.warn) {
            console.warn("Deprecation warning: " + msg);
        }
    }

    function deprecate(msg, fn) {
        var firstTime = true;
        return extend(function () {
            if (firstTime) {
                printMsg(msg);
                firstTime = false;
            }
            return fn.apply(this, arguments);
        }, fn);
    }

    function deprecateSimple(name, msg) {
        if (!deprecations[name]) {
            printMsg(msg);
            deprecations[name] = true;
        }
    }

    function padToken(func, count) {
        return function (a) {
            return leftZeroFill(func.call(this, a), count);
        };
    }
    function ordinalizeToken(func, period) {
        return function (a) {
            return this.localeData().ordinal(func.call(this, a), period);
        };
    }

    while (ordinalizeTokens.length) {
        i = ordinalizeTokens.pop();
        formatTokenFunctions[i + 'o'] = ordinalizeToken(formatTokenFunctions[i], i);
    }
    while (paddedTokens.length) {
        i = paddedTokens.pop();
        formatTokenFunctions[i + i] = padToken(formatTokenFunctions[i], 2);
    }
    formatTokenFunctions.DDDD = padToken(formatTokenFunctions.DDD, 3);


    /************************************
        Constructors
    ************************************/

    function Locale() {
    }

    // Moment prototype object
    function Moment(config, skipOverflow) {
        if (skipOverflow !== false) {
            checkOverflow(config);
        }
        copyConfig(this, config);
        this._d = new Date(+config._d);
    }

    // Duration Constructor
    function Duration(duration) {
        var normalizedInput = normalizeObjectUnits(duration),
            years = normalizedInput.year || 0,
            quarters = normalizedInput.quarter || 0,
            months = normalizedInput.month || 0,
            weeks = normalizedInput.week || 0,
            days = normalizedInput.day || 0,
            hours = normalizedInput.hour || 0,
            minutes = normalizedInput.minute || 0,
            seconds = normalizedInput.second || 0,
            milliseconds = normalizedInput.millisecond || 0;

        // representation for dateAddRemove
        this._milliseconds = +milliseconds +
            seconds * 1e3 + // 1000
            minutes * 6e4 + // 1000 * 60
            hours * 36e5; // 1000 * 60 * 60
        // Because of dateAddRemove treats 24 hours as different from a
        // day when working around DST, we need to store them separately
        this._days = +days +
            weeks * 7;
        // It is impossible translate months into days without knowing
        // which months you are are talking about, so we have to store
        // it separately.
        this._months = +months +
            quarters * 3 +
            years * 12;

        this._data = {};

        this._locale = moment.localeData();

        this._bubble();
    }

    /************************************
        Helpers
    ************************************/


    function extend(a, b) {
        for (var i in b) {
            if (b.hasOwnProperty(i)) {
                a[i] = b[i];
            }
        }

        if (b.hasOwnProperty('toString')) {
            a.toString = b.toString;
        }

        if (b.hasOwnProperty('valueOf')) {
            a.valueOf = b.valueOf;
        }

        return a;
    }

    function copyConfig(to, from) {
        var i, prop, val;

        if (typeof from._isAMomentObject !== 'undefined') {
            to._isAMomentObject = from._isAMomentObject;
        }
        if (typeof from._i !== 'undefined') {
            to._i = from._i;
        }
        if (typeof from._f !== 'undefined') {
            to._f = from._f;
        }
        if (typeof from._l !== 'undefined') {
            to._l = from._l;
        }
        if (typeof from._strict !== 'undefined') {
            to._strict = from._strict;
        }
        if (typeof from._tzm !== 'undefined') {
            to._tzm = from._tzm;
        }
        if (typeof from._isUTC !== 'undefined') {
            to._isUTC = from._isUTC;
        }
        if (typeof from._offset !== 'undefined') {
            to._offset = from._offset;
        }
        if (typeof from._pf !== 'undefined') {
            to._pf = from._pf;
        }
        if (typeof from._locale !== 'undefined') {
            to._locale = from._locale;
        }

        if (momentProperties.length > 0) {
            for (i in momentProperties) {
                prop = momentProperties[i];
                val = from[prop];
                if (typeof val !== 'undefined') {
                    to[prop] = val;
                }
            }
        }

        return to;
    }

    function absRound(number) {
        if (number < 0) {
            return Math.ceil(number);
        } else {
            return Math.floor(number);
        }
    }

    // left zero fill a number
    // see http://jsperf.com/left-zero-filling for performance comparison
    function leftZeroFill(number, targetLength, forceSign) {
        var output = '' + Math.abs(number),
            sign = number >= 0;

        while (output.length < targetLength) {
            output = '0' + output;
        }
        return (sign ? (forceSign ? '+' : '') : '-') + output;
    }

    function positiveMomentsDifference(base, other) {
        var res = {milliseconds: 0, months: 0};

        res.months = other.month() - base.month() +
            (other.year() - base.year()) * 12;
        if (base.clone().add(res.months, 'M').isAfter(other)) {
            --res.months;
        }

        res.milliseconds = +other - +(base.clone().add(res.months, 'M'));

        return res;
    }

    function momentsDifference(base, other) {
        var res;
        other = makeAs(other, base);
        if (base.isBefore(other)) {
            res = positiveMomentsDifference(base, other);
        } else {
            res = positiveMomentsDifference(other, base);
            res.milliseconds = -res.milliseconds;
            res.months = -res.months;
        }

        return res;
    }

    // TODO: remove 'name' arg after deprecation is removed
    function createAdder(direction, name) {
        return function (val, period) {
            var dur, tmp;
            //invert the arguments, but complain about it
            if (period !== null && !isNaN(+period)) {
                deprecateSimple(name, "moment()." + name  + "(period, number) is deprecated. Please use moment()." + name + "(number, period).");
                tmp = val; val = period; period = tmp;
            }

            val = typeof val === 'string' ? +val : val;
            dur = moment.duration(val, period);
            addOrSubtractDurationFromMoment(this, dur, direction);
            return this;
        };
    }

    function addOrSubtractDurationFromMoment(mom, duration, isAdding, updateOffset) {
        var milliseconds = duration._milliseconds,
            days = duration._days,
            months = duration._months;
        updateOffset = updateOffset == null ? true : updateOffset;

        if (milliseconds) {
            mom._d.setTime(+mom._d + milliseconds * isAdding);
        }
        if (days) {
            rawSetter(mom, 'Date', rawGetter(mom, 'Date') + days * isAdding);
        }
        if (months) {
            rawMonthSetter(mom, rawGetter(mom, 'Month') + months * isAdding);
        }
        if (updateOffset) {
            moment.updateOffset(mom, days || months);
        }
    }

    // check if is an array
    function isArray(input) {
        return Object.prototype.toString.call(input) === '[object Array]';
    }

    function isDate(input) {
        return Object.prototype.toString.call(input) === '[object Date]' ||
            input instanceof Date;
    }

    // compare two arrays, return the number of differences
    function compareArrays(array1, array2, dontConvert) {
        var len = Math.min(array1.length, array2.length),
            lengthDiff = Math.abs(array1.length - array2.length),
            diffs = 0,
            i;
        for (i = 0; i < len; i++) {
            if ((dontConvert && array1[i] !== array2[i]) ||
                (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))) {
                diffs++;
            }
        }
        return diffs + lengthDiff;
    }

    function normalizeUnits(units) {
        if (units) {
            var lowered = units.toLowerCase().replace(/(.)s$/, '$1');
            units = unitAliases[units] || camelFunctions[lowered] || lowered;
        }
        return units;
    }

    function normalizeObjectUnits(inputObject) {
        var normalizedInput = {},
            normalizedProp,
            prop;

        for (prop in inputObject) {
            if (inputObject.hasOwnProperty(prop)) {
                normalizedProp = normalizeUnits(prop);
                if (normalizedProp) {
                    normalizedInput[normalizedProp] = inputObject[prop];
                }
            }
        }

        return normalizedInput;
    }

    function makeList(field) {
        var count, setter;

        if (field.indexOf('week') === 0) {
            count = 7;
            setter = 'day';
        }
        else if (field.indexOf('month') === 0) {
            count = 12;
            setter = 'month';
        }
        else {
            return;
        }

        moment[field] = function (format, index) {
            var i, getter,
                method = moment._locale[field],
                results = [];

            if (typeof format === 'number') {
                index = format;
                format = undefined;
            }

            getter = function (i) {
                var m = moment().utc().set(setter, i);
                return method.call(moment._locale, m, format || '');
            };

            if (index != null) {
                return getter(index);
            }
            else {
                for (i = 0; i < count; i++) {
                    results.push(getter(i));
                }
                return results;
            }
        };
    }

    function toInt(argumentForCoercion) {
        var coercedNumber = +argumentForCoercion,
            value = 0;

        if (coercedNumber !== 0 && isFinite(coercedNumber)) {
            if (coercedNumber >= 0) {
                value = Math.floor(coercedNumber);
            } else {
                value = Math.ceil(coercedNumber);
            }
        }

        return value;
    }

    function daysInMonth(year, month) {
        return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    }

    function weeksInYear(year, dow, doy) {
        return weekOfYear(moment([year, 11, 31 + dow - doy]), dow, doy).week;
    }

    function daysInYear(year) {
        return isLeapYear(year) ? 366 : 365;
    }

    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    function checkOverflow(m) {
        var overflow;
        if (m._a && m._pf.overflow === -2) {
            overflow =
                m._a[MONTH] < 0 || m._a[MONTH] > 11 ? MONTH :
                m._a[DATE] < 1 || m._a[DATE] > daysInMonth(m._a[YEAR], m._a[MONTH]) ? DATE :
                m._a[HOUR] < 0 || m._a[HOUR] > 23 ? HOUR :
                m._a[MINUTE] < 0 || m._a[MINUTE] > 59 ? MINUTE :
                m._a[SECOND] < 0 || m._a[SECOND] > 59 ? SECOND :
                m._a[MILLISECOND] < 0 || m._a[MILLISECOND] > 999 ? MILLISECOND :
                -1;

            if (m._pf._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
                overflow = DATE;
            }

            m._pf.overflow = overflow;
        }
    }

    function isValid(m) {
        if (m._isValid == null) {
            m._isValid = !isNaN(m._d.getTime()) &&
                m._pf.overflow < 0 &&
                !m._pf.empty &&
                !m._pf.invalidMonth &&
                !m._pf.nullInput &&
                !m._pf.invalidFormat &&
                !m._pf.userInvalidated;

            if (m._strict) {
                m._isValid = m._isValid &&
                    m._pf.charsLeftOver === 0 &&
                    m._pf.unusedTokens.length === 0;
            }
        }
        return m._isValid;
    }

    function normalizeLocale(key) {
        return key ? key.toLowerCase().replace('_', '-') : key;
    }

    // pick the locale from the array
    // try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
    // substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
    function chooseLocale(names) {
        var i = 0, j, next, locale, split;

        while (i < names.length) {
            split = normalizeLocale(names[i]).split('-');
            j = split.length;
            next = normalizeLocale(names[i + 1]);
            next = next ? next.split('-') : null;
            while (j > 0) {
                locale = loadLocale(split.slice(0, j).join('-'));
                if (locale) {
                    return locale;
                }
                if (next && next.length >= j && compareArrays(split, next, true) >= j - 1) {
                    //the next array item is better than a shallower substring of this one
                    break;
                }
                j--;
            }
            i++;
        }
        return null;
    }

    function loadLocale(name) {
        var oldLocale = null;
        if (!locales[name] && hasModule) {
            try {
                oldLocale = moment.locale();
                require('./locale/' + name);
                // because defineLocale currently also sets the global locale, we want to undo that for lazy loaded locales
                moment.locale(oldLocale);
            } catch (e) { }
        }
        return locales[name];
    }

    // Return a moment from input, that is local/utc/zone equivalent to model.
    function makeAs(input, model) {
        return model._isUTC ? moment(input).zone(model._offset || 0) :
            moment(input).local();
    }

    /************************************
        Locale
    ************************************/


    extend(Locale.prototype, {

        set : function (config) {
            var prop, i;
            for (i in config) {
                prop = config[i];
                if (typeof prop === 'function') {
                    this[i] = prop;
                } else {
                    this['_' + i] = prop;
                }
            }
        },

        _months : 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_'),
        months : function (m) {
            return this._months[m.month()];
        },

        _monthsShort : 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_'),
        monthsShort : function (m) {
            return this._monthsShort[m.month()];
        },

        monthsParse : function (monthName) {
            var i, mom, regex;

            if (!this._monthsParse) {
                this._monthsParse = [];
            }

            for (i = 0; i < 12; i++) {
                // make the regex if we don't have it already
                if (!this._monthsParse[i]) {
                    mom = moment.utc([2000, i]);
                    regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                    this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
                }
                // test the regex
                if (this._monthsParse[i].test(monthName)) {
                    return i;
                }
            }
        },

        _weekdays : 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_'),
        weekdays : function (m) {
            return this._weekdays[m.day()];
        },

        _weekdaysShort : 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_'),
        weekdaysShort : function (m) {
            return this._weekdaysShort[m.day()];
        },

        _weekdaysMin : 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_'),
        weekdaysMin : function (m) {
            return this._weekdaysMin[m.day()];
        },

        weekdaysParse : function (weekdayName) {
            var i, mom, regex;

            if (!this._weekdaysParse) {
                this._weekdaysParse = [];
            }

            for (i = 0; i < 7; i++) {
                // make the regex if we don't have it already
                if (!this._weekdaysParse[i]) {
                    mom = moment([2000, 1]).day(i);
                    regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                    this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
                }
                // test the regex
                if (this._weekdaysParse[i].test(weekdayName)) {
                    return i;
                }
            }
        },

        _longDateFormat : {
            LT : 'h:mm A',
            L : 'MM/DD/YYYY',
            LL : 'MMMM D, YYYY',
            LLL : 'MMMM D, YYYY LT',
            LLLL : 'dddd, MMMM D, YYYY LT'
        },
        longDateFormat : function (key) {
            var output = this._longDateFormat[key];
            if (!output && this._longDateFormat[key.toUpperCase()]) {
                output = this._longDateFormat[key.toUpperCase()].replace(/MMMM|MM|DD|dddd/g, function (val) {
                    return val.slice(1);
                });
                this._longDateFormat[key] = output;
            }
            return output;
        },

        isPM : function (input) {
            // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
            // Using charAt should be more compatible.
            return ((input + '').toLowerCase().charAt(0) === 'p');
        },

        _meridiemParse : /[ap]\.?m?\.?/i,
        meridiem : function (hours, minutes, isLower) {
            if (hours > 11) {
                return isLower ? 'pm' : 'PM';
            } else {
                return isLower ? 'am' : 'AM';
            }
        },

        _calendar : {
            sameDay : '[Today at] LT',
            nextDay : '[Tomorrow at] LT',
            nextWeek : 'dddd [at] LT',
            lastDay : '[Yesterday at] LT',
            lastWeek : '[Last] dddd [at] LT',
            sameElse : 'L'
        },
        calendar : function (key, mom) {
            var output = this._calendar[key];
            return typeof output === 'function' ? output.apply(mom) : output;
        },

        _relativeTime : {
            future : 'in %s',
            past : '%s ago',
            s : 'a few seconds',
            m : 'a minute',
            mm : '%d minutes',
            h : 'an hour',
            hh : '%d hours',
            d : 'a day',
            dd : '%d days',
            M : 'a month',
            MM : '%d months',
            y : 'a year',
            yy : '%d years'
        },

        relativeTime : function (number, withoutSuffix, string, isFuture) {
            var output = this._relativeTime[string];
            return (typeof output === 'function') ?
                output(number, withoutSuffix, string, isFuture) :
                output.replace(/%d/i, number);
        },

        pastFuture : function (diff, output) {
            var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
            return typeof format === 'function' ? format(output) : format.replace(/%s/i, output);
        },

        ordinal : function (number) {
            return this._ordinal.replace('%d', number);
        },
        _ordinal : '%d',

        preparse : function (string) {
            return string;
        },

        postformat : function (string) {
            return string;
        },

        week : function (mom) {
            return weekOfYear(mom, this._week.dow, this._week.doy).week;
        },

        _week : {
            dow : 0, // Sunday is the first day of the week.
            doy : 6  // The week that contains Jan 1st is the first week of the year.
        },

        _invalidDate: 'Invalid date',
        invalidDate: function () {
            return this._invalidDate;
        }
    });

    /************************************
        Formatting
    ************************************/


    function removeFormattingTokens(input) {
        if (input.match(/\[[\s\S]/)) {
            return input.replace(/^\[|\]$/g, '');
        }
        return input.replace(/\\/g, '');
    }

    function makeFormatFunction(format) {
        var array = format.match(formattingTokens), i, length;

        for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
                array[i] = formatTokenFunctions[array[i]];
            } else {
                array[i] = removeFormattingTokens(array[i]);
            }
        }

        return function (mom) {
            var output = '';
            for (i = 0; i < length; i++) {
                output += array[i] instanceof Function ? array[i].call(mom, format) : array[i];
            }
            return output;
        };
    }

    // format date using native date object
    function formatMoment(m, format) {
        if (!m.isValid()) {
            return m.localeData().invalidDate();
        }

        format = expandFormat(format, m.localeData());

        if (!formatFunctions[format]) {
            formatFunctions[format] = makeFormatFunction(format);
        }

        return formatFunctions[format](m);
    }

    function expandFormat(format, locale) {
        var i = 5;

        function replaceLongDateFormatTokens(input) {
            return locale.longDateFormat(input) || input;
        }

        localFormattingTokens.lastIndex = 0;
        while (i >= 0 && localFormattingTokens.test(format)) {
            format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
            localFormattingTokens.lastIndex = 0;
            i -= 1;
        }

        return format;
    }


    /************************************
        Parsing
    ************************************/


    // get the regex to find the next token
    function getParseRegexForToken(token, config) {
        var a, strict = config._strict;
        switch (token) {
        case 'Q':
            return parseTokenOneDigit;
        case 'DDDD':
            return parseTokenThreeDigits;
        case 'YYYY':
        case 'GGGG':
        case 'gggg':
            return strict ? parseTokenFourDigits : parseTokenOneToFourDigits;
        case 'Y':
        case 'G':
        case 'g':
            return parseTokenSignedNumber;
        case 'YYYYYY':
        case 'YYYYY':
        case 'GGGGG':
        case 'ggggg':
            return strict ? parseTokenSixDigits : parseTokenOneToSixDigits;
        case 'S':
            if (strict) {
                return parseTokenOneDigit;
            }
            /* falls through */
        case 'SS':
            if (strict) {
                return parseTokenTwoDigits;
            }
            /* falls through */
        case 'SSS':
            if (strict) {
                return parseTokenThreeDigits;
            }
            /* falls through */
        case 'DDD':
            return parseTokenOneToThreeDigits;
        case 'MMM':
        case 'MMMM':
        case 'dd':
        case 'ddd':
        case 'dddd':
            return parseTokenWord;
        case 'a':
        case 'A':
            return config._locale._meridiemParse;
        case 'X':
            return parseTokenTimestampMs;
        case 'Z':
        case 'ZZ':
            return parseTokenTimezone;
        case 'T':
            return parseTokenT;
        case 'SSSS':
            return parseTokenDigits;
        case 'MM':
        case 'DD':
        case 'YY':
        case 'GG':
        case 'gg':
        case 'HH':
        case 'hh':
        case 'mm':
        case 'ss':
        case 'ww':
        case 'WW':
            return strict ? parseTokenTwoDigits : parseTokenOneOrTwoDigits;
        case 'M':
        case 'D':
        case 'd':
        case 'H':
        case 'h':
        case 'm':
        case 's':
        case 'w':
        case 'W':
        case 'e':
        case 'E':
            return parseTokenOneOrTwoDigits;
        case 'Do':
            return parseTokenOrdinal;
        default :
            a = new RegExp(regexpEscape(unescapeFormat(token.replace('\\', '')), 'i'));
            return a;
        }
    }

    function timezoneMinutesFromString(string) {
        string = string || '';
        var possibleTzMatches = (string.match(parseTokenTimezone) || []),
            tzChunk = possibleTzMatches[possibleTzMatches.length - 1] || [],
            parts = (tzChunk + '').match(parseTimezoneChunker) || ['-', 0, 0],
            minutes = +(parts[1] * 60) + toInt(parts[2]);

        return parts[0] === '+' ? -minutes : minutes;
    }

    // function to convert string input to date
    function addTimeToArrayFromToken(token, input, config) {
        var a, datePartArray = config._a;

        switch (token) {
        // QUARTER
        case 'Q':
            if (input != null) {
                datePartArray[MONTH] = (toInt(input) - 1) * 3;
            }
            break;
        // MONTH
        case 'M' : // fall through to MM
        case 'MM' :
            if (input != null) {
                datePartArray[MONTH] = toInt(input) - 1;
            }
            break;
        case 'MMM' : // fall through to MMMM
        case 'MMMM' :
            a = config._locale.monthsParse(input);
            // if we didn't find a month name, mark the date as invalid.
            if (a != null) {
                datePartArray[MONTH] = a;
            } else {
                config._pf.invalidMonth = input;
            }
            break;
        // DAY OF MONTH
        case 'D' : // fall through to DD
        case 'DD' :
            if (input != null) {
                datePartArray[DATE] = toInt(input);
            }
            break;
        case 'Do' :
            if (input != null) {
                datePartArray[DATE] = toInt(parseInt(input, 10));
            }
            break;
        // DAY OF YEAR
        case 'DDD' : // fall through to DDDD
        case 'DDDD' :
            if (input != null) {
                config._dayOfYear = toInt(input);
            }

            break;
        // YEAR
        case 'YY' :
            datePartArray[YEAR] = moment.parseTwoDigitYear(input);
            break;
        case 'YYYY' :
        case 'YYYYY' :
        case 'YYYYYY' :
            datePartArray[YEAR] = toInt(input);
            break;
        // AM / PM
        case 'a' : // fall through to A
        case 'A' :
            config._isPm = config._locale.isPM(input);
            break;
        // 24 HOUR
        case 'H' : // fall through to hh
        case 'HH' : // fall through to hh
        case 'h' : // fall through to hh
        case 'hh' :
            datePartArray[HOUR] = toInt(input);
            break;
        // MINUTE
        case 'm' : // fall through to mm
        case 'mm' :
            datePartArray[MINUTE] = toInt(input);
            break;
        // SECOND
        case 's' : // fall through to ss
        case 'ss' :
            datePartArray[SECOND] = toInt(input);
            break;
        // MILLISECOND
        case 'S' :
        case 'SS' :
        case 'SSS' :
        case 'SSSS' :
            datePartArray[MILLISECOND] = toInt(('0.' + input) * 1000);
            break;
        // UNIX TIMESTAMP WITH MS
        case 'X':
            config._d = new Date(parseFloat(input) * 1000);
            break;
        // TIMEZONE
        case 'Z' : // fall through to ZZ
        case 'ZZ' :
            config._useUTC = true;
            config._tzm = timezoneMinutesFromString(input);
            break;
        // WEEKDAY - human
        case 'dd':
        case 'ddd':
        case 'dddd':
            a = config._locale.weekdaysParse(input);
            // if we didn't get a weekday name, mark the date as invalid
            if (a != null) {
                config._w = config._w || {};
                config._w['d'] = a;
            } else {
                config._pf.invalidWeekday = input;
            }
            break;
        // WEEK, WEEK DAY - numeric
        case 'w':
        case 'ww':
        case 'W':
        case 'WW':
        case 'd':
        case 'e':
        case 'E':
            token = token.substr(0, 1);
            /* falls through */
        case 'gggg':
        case 'GGGG':
        case 'GGGGG':
            token = token.substr(0, 2);
            if (input) {
                config._w = config._w || {};
                config._w[token] = toInt(input);
            }
            break;
        case 'gg':
        case 'GG':
            config._w = config._w || {};
            config._w[token] = moment.parseTwoDigitYear(input);
        }
    }

    function dayOfYearFromWeekInfo(config) {
        var w, weekYear, week, weekday, dow, doy, temp;

        w = config._w;
        if (w.GG != null || w.W != null || w.E != null) {
            dow = 1;
            doy = 4;

            // TODO: We need to take the current isoWeekYear, but that depends on
            // how we interpret now (local, utc, fixed offset). So create
            // a now version of current config (take local/utc/offset flags, and
            // create now).
            weekYear = dfl(w.GG, config._a[YEAR], weekOfYear(moment(), 1, 4).year);
            week = dfl(w.W, 1);
            weekday = dfl(w.E, 1);
        } else {
            dow = config._locale._week.dow;
            doy = config._locale._week.doy;

            weekYear = dfl(w.gg, config._a[YEAR], weekOfYear(moment(), dow, doy).year);
            week = dfl(w.w, 1);

            if (w.d != null) {
                // weekday -- low day numbers are considered next week
                weekday = w.d;
                if (weekday < dow) {
                    ++week;
                }
            } else if (w.e != null) {
                // local weekday -- counting starts from begining of week
                weekday = w.e + dow;
            } else {
                // default to begining of week
                weekday = dow;
            }
        }
        temp = dayOfYearFromWeeks(weekYear, week, weekday, doy, dow);

        config._a[YEAR] = temp.year;
        config._dayOfYear = temp.dayOfYear;
    }

    // convert an array to a date.
    // the array should mirror the parameters below
    // note: all values past the year are optional and will default to the lowest possible value.
    // [year, month, day , hour, minute, second, millisecond]
    function dateFromConfig(config) {
        var i, date, input = [], currentDate, yearToUse;

        if (config._d) {
            return;
        }

        currentDate = currentDateArray(config);

        //compute day of the year from weeks and weekdays
        if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
            dayOfYearFromWeekInfo(config);
        }

        //if the day of the year is set, figure out what it is
        if (config._dayOfYear) {
            yearToUse = dfl(config._a[YEAR], currentDate[YEAR]);

            if (config._dayOfYear > daysInYear(yearToUse)) {
                config._pf._overflowDayOfYear = true;
            }

            date = makeUTCDate(yearToUse, 0, config._dayOfYear);
            config._a[MONTH] = date.getUTCMonth();
            config._a[DATE] = date.getUTCDate();
        }

        // Default to current date.
        // * if no year, month, day of month are given, default to today
        // * if day of month is given, default month and year
        // * if month is given, default only year
        // * if year is given, don't default anything
        for (i = 0; i < 3 && config._a[i] == null; ++i) {
            config._a[i] = input[i] = currentDate[i];
        }

        // Zero out whatever was not defaulted, including time
        for (; i < 7; i++) {
            config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
        }

        config._d = (config._useUTC ? makeUTCDate : makeDate).apply(null, input);
        // Apply timezone offset from input. The actual zone can be changed
        // with parseZone.
        if (config._tzm != null) {
            config._d.setUTCMinutes(config._d.getUTCMinutes() + config._tzm);
        }
    }

    function dateFromObject(config) {
        var normalizedInput;

        if (config._d) {
            return;
        }

        normalizedInput = normalizeObjectUnits(config._i);
        config._a = [
            normalizedInput.year,
            normalizedInput.month,
            normalizedInput.day,
            normalizedInput.hour,
            normalizedInput.minute,
            normalizedInput.second,
            normalizedInput.millisecond
        ];

        dateFromConfig(config);
    }

    function currentDateArray(config) {
        var now = new Date();
        if (config._useUTC) {
            return [
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate()
            ];
        } else {
            return [now.getFullYear(), now.getMonth(), now.getDate()];
        }
    }

    // date from string and format string
    function makeDateFromStringAndFormat(config) {
        if (config._f === moment.ISO_8601) {
            parseISO(config);
            return;
        }

        config._a = [];
        config._pf.empty = true;

        // This array is used to make a Date, either with `new Date` or `Date.UTC`
        var string = '' + config._i,
            i, parsedInput, tokens, token, skipped,
            stringLength = string.length,
            totalParsedInputLength = 0;

        tokens = expandFormat(config._f, config._locale).match(formattingTokens) || [];

        for (i = 0; i < tokens.length; i++) {
            token = tokens[i];
            parsedInput = (string.match(getParseRegexForToken(token, config)) || [])[0];
            if (parsedInput) {
                skipped = string.substr(0, string.indexOf(parsedInput));
                if (skipped.length > 0) {
                    config._pf.unusedInput.push(skipped);
                }
                string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
                totalParsedInputLength += parsedInput.length;
            }
            // don't parse if it's not a known token
            if (formatTokenFunctions[token]) {
                if (parsedInput) {
                    config._pf.empty = false;
                }
                else {
                    config._pf.unusedTokens.push(token);
                }
                addTimeToArrayFromToken(token, parsedInput, config);
            }
            else if (config._strict && !parsedInput) {
                config._pf.unusedTokens.push(token);
            }
        }

        // add remaining unparsed input length to the string
        config._pf.charsLeftOver = stringLength - totalParsedInputLength;
        if (string.length > 0) {
            config._pf.unusedInput.push(string);
        }

        // handle am pm
        if (config._isPm && config._a[HOUR] < 12) {
            config._a[HOUR] += 12;
        }
        // if is 12 am, change hours to 0
        if (config._isPm === false && config._a[HOUR] === 12) {
            config._a[HOUR] = 0;
        }

        dateFromConfig(config);
        checkOverflow(config);
    }

    function unescapeFormat(s) {
        return s.replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g, function (matched, p1, p2, p3, p4) {
            return p1 || p2 || p3 || p4;
        });
    }

    // Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
    function regexpEscape(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    // date from string and array of format strings
    function makeDateFromStringAndArray(config) {
        var tempConfig,
            bestMoment,

            scoreToBeat,
            i,
            currentScore;

        if (config._f.length === 0) {
            config._pf.invalidFormat = true;
            config._d = new Date(NaN);
            return;
        }

        for (i = 0; i < config._f.length; i++) {
            currentScore = 0;
            tempConfig = copyConfig({}, config);
            tempConfig._pf = defaultParsingFlags();
            tempConfig._f = config._f[i];
            makeDateFromStringAndFormat(tempConfig);

            if (!isValid(tempConfig)) {
                continue;
            }

            // if there is any input that was not parsed add a penalty for that format
            currentScore += tempConfig._pf.charsLeftOver;

            //or tokens
            currentScore += tempConfig._pf.unusedTokens.length * 10;

            tempConfig._pf.score = currentScore;

            if (scoreToBeat == null || currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
            }
        }

        extend(config, bestMoment || tempConfig);
    }

    // date from iso format
    function parseISO(config) {
        var i, l,
            string = config._i,
            match = isoRegex.exec(string);

        if (match) {
            config._pf.iso = true;
            for (i = 0, l = isoDates.length; i < l; i++) {
                if (isoDates[i][1].exec(string)) {
                    // match[5] should be "T" or undefined
                    config._f = isoDates[i][0] + (match[6] || ' ');
                    break;
                }
            }
            for (i = 0, l = isoTimes.length; i < l; i++) {
                if (isoTimes[i][1].exec(string)) {
                    config._f += isoTimes[i][0];
                    break;
                }
            }
            if (string.match(parseTokenTimezone)) {
                config._f += 'Z';
            }
            makeDateFromStringAndFormat(config);
        } else {
            config._isValid = false;
        }
    }

    // date from iso format or fallback
    function makeDateFromString(config) {
        parseISO(config);
        if (config._isValid === false) {
            delete config._isValid;
            moment.createFromInputFallback(config);
        }
    }

    function makeDateFromInput(config) {
        var input = config._i, matched;
        if (input === undefined) {
            config._d = new Date();
        } else if (isDate(input)) {
            config._d = new Date(+input);
        } else if ((matched = aspNetJsonRegex.exec(input)) !== null) {
            config._d = new Date(+matched[1]);
        } else if (typeof input === 'string') {
            makeDateFromString(config);
        } else if (isArray(input)) {
            config._a = input.slice(0);
            dateFromConfig(config);
        } else if (typeof(input) === 'object') {
            dateFromObject(config);
        } else if (typeof(input) === 'number') {
            // from milliseconds
            config._d = new Date(input);
        } else {
            moment.createFromInputFallback(config);
        }
    }

    function makeDate(y, m, d, h, M, s, ms) {
        //can't just apply() to create a date:
        //http://stackoverflow.com/questions/181348/instantiating-a-javascript-object-by-calling-prototype-constructor-apply
        var date = new Date(y, m, d, h, M, s, ms);

        //the date constructor doesn't accept years < 1970
        if (y < 1970) {
            date.setFullYear(y);
        }
        return date;
    }

    function makeUTCDate(y) {
        var date = new Date(Date.UTC.apply(null, arguments));
        if (y < 1970) {
            date.setUTCFullYear(y);
        }
        return date;
    }

    function parseWeekday(input, locale) {
        if (typeof input === 'string') {
            if (!isNaN(input)) {
                input = parseInt(input, 10);
            }
            else {
                input = locale.weekdaysParse(input);
                if (typeof input !== 'number') {
                    return null;
                }
            }
        }
        return input;
    }

    /************************************
        Relative Time
    ************************************/


    // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
    function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
        return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
    }

    function relativeTime(posNegDuration, withoutSuffix, locale) {
        var duration = moment.duration(posNegDuration).abs(),
            seconds = round(duration.as('s')),
            minutes = round(duration.as('m')),
            hours = round(duration.as('h')),
            days = round(duration.as('d')),
            months = round(duration.as('M')),
            years = round(duration.as('y')),

            args = seconds < relativeTimeThresholds.s && ['s', seconds] ||
                minutes === 1 && ['m'] ||
                minutes < relativeTimeThresholds.m && ['mm', minutes] ||
                hours === 1 && ['h'] ||
                hours < relativeTimeThresholds.h && ['hh', hours] ||
                days === 1 && ['d'] ||
                days < relativeTimeThresholds.d && ['dd', days] ||
                months === 1 && ['M'] ||
                months < relativeTimeThresholds.M && ['MM', months] ||
                years === 1 && ['y'] || ['yy', years];

        args[2] = withoutSuffix;
        args[3] = +posNegDuration > 0;
        args[4] = locale;
        return substituteTimeAgo.apply({}, args);
    }


    /************************************
        Week of Year
    ************************************/


    // firstDayOfWeek       0 = sun, 6 = sat
    //                      the day of the week that starts the week
    //                      (usually sunday or monday)
    // firstDayOfWeekOfYear 0 = sun, 6 = sat
    //                      the first week is the week that contains the first
    //                      of this day of the week
    //                      (eg. ISO weeks use thursday (4))
    function weekOfYear(mom, firstDayOfWeek, firstDayOfWeekOfYear) {
        var end = firstDayOfWeekOfYear - firstDayOfWeek,
            daysToDayOfWeek = firstDayOfWeekOfYear - mom.day(),
            adjustedMoment;


        if (daysToDayOfWeek > end) {
            daysToDayOfWeek -= 7;
        }

        if (daysToDayOfWeek < end - 7) {
            daysToDayOfWeek += 7;
        }

        adjustedMoment = moment(mom).add(daysToDayOfWeek, 'd');
        return {
            week: Math.ceil(adjustedMoment.dayOfYear() / 7),
            year: adjustedMoment.year()
        };
    }

    //http://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
    function dayOfYearFromWeeks(year, week, weekday, firstDayOfWeekOfYear, firstDayOfWeek) {
        var d = makeUTCDate(year, 0, 1).getUTCDay(), daysToAdd, dayOfYear;

        d = d === 0 ? 7 : d;
        weekday = weekday != null ? weekday : firstDayOfWeek;
        daysToAdd = firstDayOfWeek - d + (d > firstDayOfWeekOfYear ? 7 : 0) - (d < firstDayOfWeek ? 7 : 0);
        dayOfYear = 7 * (week - 1) + (weekday - firstDayOfWeek) + daysToAdd + 1;

        return {
            year: dayOfYear > 0 ? year : year - 1,
            dayOfYear: dayOfYear > 0 ?  dayOfYear : daysInYear(year - 1) + dayOfYear
        };
    }

    /************************************
        Top Level Functions
    ************************************/

    function makeMoment(config) {
        var input = config._i,
            format = config._f;

        config._locale = config._locale || moment.localeData(config._l);

        if (input === null || (format === undefined && input === '')) {
            return moment.invalid({nullInput: true});
        }

        if (typeof input === 'string') {
            config._i = input = config._locale.preparse(input);
        }

        if (moment.isMoment(input)) {
            return new Moment(input, true);
        } else if (format) {
            if (isArray(format)) {
                makeDateFromStringAndArray(config);
            } else {
                makeDateFromStringAndFormat(config);
            }
        } else {
            makeDateFromInput(config);
        }

        return new Moment(config);
    }

    moment = function (input, format, locale, strict) {
        var c;

        if (typeof(locale) === "boolean") {
            strict = locale;
            locale = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c = {};
        c._isAMomentObject = true;
        c._i = input;
        c._f = format;
        c._l = locale;
        c._strict = strict;
        c._isUTC = false;
        c._pf = defaultParsingFlags();

        return makeMoment(c);
    };

    moment.suppressDeprecationWarnings = false;

    moment.createFromInputFallback = deprecate(
        'moment construction falls back to js Date. This is ' +
        'discouraged and will be removed in upcoming major ' +
        'release. Please refer to ' +
        'https://github.com/moment/moment/issues/1407 for more info.',
        function (config) {
            config._d = new Date(config._i);
        }
    );

    // Pick a moment m from moments so that m[fn](other) is true for all
    // other. This relies on the function fn to be transitive.
    //
    // moments should either be an array of moment objects or an array, whose
    // first element is an array of moment objects.
    function pickBy(fn, moments) {
        var res, i;
        if (moments.length === 1 && isArray(moments[0])) {
            moments = moments[0];
        }
        if (!moments.length) {
            return moment();
        }
        res = moments[0];
        for (i = 1; i < moments.length; ++i) {
            if (moments[i][fn](res)) {
                res = moments[i];
            }
        }
        return res;
    }

    moment.min = function () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isBefore', args);
    };

    moment.max = function () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isAfter', args);
    };

    // creating with utc
    moment.utc = function (input, format, locale, strict) {
        var c;

        if (typeof(locale) === "boolean") {
            strict = locale;
            locale = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c = {};
        c._isAMomentObject = true;
        c._useUTC = true;
        c._isUTC = true;
        c._l = locale;
        c._i = input;
        c._f = format;
        c._strict = strict;
        c._pf = defaultParsingFlags();

        return makeMoment(c).utc();
    };

    // creating with unix timestamp (in seconds)
    moment.unix = function (input) {
        return moment(input * 1000);
    };

    // duration
    moment.duration = function (input, key) {
        var duration = input,
            // matching against regexp is expensive, do it on demand
            match = null,
            sign,
            ret,
            parseIso,
            diffRes;

        if (moment.isDuration(input)) {
            duration = {
                ms: input._milliseconds,
                d: input._days,
                M: input._months
            };
        } else if (typeof input === 'number') {
            duration = {};
            if (key) {
                duration[key] = input;
            } else {
                duration.milliseconds = input;
            }
        } else if (!!(match = aspNetTimeSpanJsonRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y: 0,
                d: toInt(match[DATE]) * sign,
                h: toInt(match[HOUR]) * sign,
                m: toInt(match[MINUTE]) * sign,
                s: toInt(match[SECOND]) * sign,
                ms: toInt(match[MILLISECOND]) * sign
            };
        } else if (!!(match = isoDurationRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            parseIso = function (inp) {
                // We'd normally use ~~inp for this, but unfortunately it also
                // converts floats to ints.
                // inp may be undefined, so careful calling replace on it.
                var res = inp && parseFloat(inp.replace(',', '.'));
                // apply sign while we're at it
                return (isNaN(res) ? 0 : res) * sign;
            };
            duration = {
                y: parseIso(match[2]),
                M: parseIso(match[3]),
                d: parseIso(match[4]),
                h: parseIso(match[5]),
                m: parseIso(match[6]),
                s: parseIso(match[7]),
                w: parseIso(match[8])
            };
        } else if (typeof duration === 'object' &&
                ('from' in duration || 'to' in duration)) {
            diffRes = momentsDifference(moment(duration.from), moment(duration.to));

            duration = {};
            duration.ms = diffRes.milliseconds;
            duration.M = diffRes.months;
        }

        ret = new Duration(duration);

        if (moment.isDuration(input) && input.hasOwnProperty('_locale')) {
            ret._locale = input._locale;
        }

        return ret;
    };

    // version number
    moment.version = VERSION;

    // default format
    moment.defaultFormat = isoFormat;

    // constant that refers to the ISO standard
    moment.ISO_8601 = function () {};

    // Plugins that add properties should also add the key here (null value),
    // so we can properly clone ourselves.
    moment.momentProperties = momentProperties;

    // This function will be called whenever a moment is mutated.
    // It is intended to keep the offset in sync with the timezone.
    moment.updateOffset = function () {};

    // This function allows you to set a threshold for relative time strings
    moment.relativeTimeThreshold = function (threshold, limit) {
        if (relativeTimeThresholds[threshold] === undefined) {
            return false;
        }
        if (limit === undefined) {
            return relativeTimeThresholds[threshold];
        }
        relativeTimeThresholds[threshold] = limit;
        return true;
    };

    moment.lang = deprecate(
        "moment.lang is deprecated. Use moment.locale instead.",
        function (key, value) {
            return moment.locale(key, value);
        }
    );

    // This function will load locale and then set the global locale.  If
    // no arguments are passed in, it will simply return the current global
    // locale key.
    moment.locale = function (key, values) {
        var data;
        if (key) {
            if (typeof(values) !== "undefined") {
                data = moment.defineLocale(key, values);
            }
            else {
                data = moment.localeData(key);
            }

            if (data) {
                moment.duration._locale = moment._locale = data;
            }
        }

        return moment._locale._abbr;
    };

    moment.defineLocale = function (name, values) {
        if (values !== null) {
            values.abbr = name;
            if (!locales[name]) {
                locales[name] = new Locale();
            }
            locales[name].set(values);

            // backwards compat for now: also set the locale
            moment.locale(name);

            return locales[name];
        } else {
            // useful for testing
            delete locales[name];
            return null;
        }
    };

    moment.langData = deprecate(
        "moment.langData is deprecated. Use moment.localeData instead.",
        function (key) {
            return moment.localeData(key);
        }
    );

    // returns locale data
    moment.localeData = function (key) {
        var locale;

        if (key && key._locale && key._locale._abbr) {
            key = key._locale._abbr;
        }

        if (!key) {
            return moment._locale;
        }

        if (!isArray(key)) {
            //short-circuit everything else
            locale = loadLocale(key);
            if (locale) {
                return locale;
            }
            key = [key];
        }

        return chooseLocale(key);
    };

    // compare moment object
    moment.isMoment = function (obj) {
        return obj instanceof Moment ||
            (obj != null &&  obj.hasOwnProperty('_isAMomentObject'));
    };

    // for typechecking Duration objects
    moment.isDuration = function (obj) {
        return obj instanceof Duration;
    };

    for (i = lists.length - 1; i >= 0; --i) {
        makeList(lists[i]);
    }

    moment.normalizeUnits = function (units) {
        return normalizeUnits(units);
    };

    moment.invalid = function (flags) {
        var m = moment.utc(NaN);
        if (flags != null) {
            extend(m._pf, flags);
        }
        else {
            m._pf.userInvalidated = true;
        }

        return m;
    };

    moment.parseZone = function () {
        return moment.apply(null, arguments).parseZone();
    };

    moment.parseTwoDigitYear = function (input) {
        return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
    };

    /************************************
        Moment Prototype
    ************************************/


    extend(moment.fn = Moment.prototype, {

        clone : function () {
            return moment(this);
        },

        valueOf : function () {
            return +this._d + ((this._offset || 0) * 60000);
        },

        unix : function () {
            return Math.floor(+this / 1000);
        },

        toString : function () {
            return this.clone().locale('en').format("ddd MMM DD YYYY HH:mm:ss [GMT]ZZ");
        },

        toDate : function () {
            return this._offset ? new Date(+this) : this._d;
        },

        toISOString : function () {
            var m = moment(this).utc();
            if (0 < m.year() && m.year() <= 9999) {
                return formatMoment(m, 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
            } else {
                return formatMoment(m, 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
            }
        },

        toArray : function () {
            var m = this;
            return [
                m.year(),
                m.month(),
                m.date(),
                m.hours(),
                m.minutes(),
                m.seconds(),
                m.milliseconds()
            ];
        },

        isValid : function () {
            return isValid(this);
        },

        isDSTShifted : function () {
            if (this._a) {
                return this.isValid() && compareArrays(this._a, (this._isUTC ? moment.utc(this._a) : moment(this._a)).toArray()) > 0;
            }

            return false;
        },

        parsingFlags : function () {
            return extend({}, this._pf);
        },

        invalidAt: function () {
            return this._pf.overflow;
        },

        utc : function (keepLocalTime) {
            return this.zone(0, keepLocalTime);
        },

        local : function (keepLocalTime) {
            if (this._isUTC) {
                this.zone(0, keepLocalTime);
                this._isUTC = false;

                if (keepLocalTime) {
                    this.add(this._d.getTimezoneOffset(), 'm');
                }
            }
            return this;
        },

        format : function (inputString) {
            var output = formatMoment(this, inputString || moment.defaultFormat);
            return this.localeData().postformat(output);
        },

        add : createAdder(1, 'add'),

        subtract : createAdder(-1, 'subtract'),

        diff : function (input, units, asFloat) {
            var that = makeAs(input, this),
                zoneDiff = (this.zone() - that.zone()) * 6e4,
                diff, output;

            units = normalizeUnits(units);

            if (units === 'year' || units === 'month') {
                // average number of days in the months in the given dates
                diff = (this.daysInMonth() + that.daysInMonth()) * 432e5; // 24 * 60 * 60 * 1000 / 2
                // difference in months
                output = ((this.year() - that.year()) * 12) + (this.month() - that.month());
                // adjust by taking difference in days, average number of days
                // and dst in the given months.
                output += ((this - moment(this).startOf('month')) -
                        (that - moment(that).startOf('month'))) / diff;
                // same as above but with zones, to negate all dst
                output -= ((this.zone() - moment(this).startOf('month').zone()) -
                        (that.zone() - moment(that).startOf('month').zone())) * 6e4 / diff;
                if (units === 'year') {
                    output = output / 12;
                }
            } else {
                diff = (this - that);
                output = units === 'second' ? diff / 1e3 : // 1000
                    units === 'minute' ? diff / 6e4 : // 1000 * 60
                    units === 'hour' ? diff / 36e5 : // 1000 * 60 * 60
                    units === 'day' ? (diff - zoneDiff) / 864e5 : // 1000 * 60 * 60 * 24, negate dst
                    units === 'week' ? (diff - zoneDiff) / 6048e5 : // 1000 * 60 * 60 * 24 * 7, negate dst
                    diff;
            }
            return asFloat ? output : absRound(output);
        },

        from : function (time, withoutSuffix) {
            return moment.duration({to: this, from: time}).locale(this.locale()).humanize(!withoutSuffix);
        },

        fromNow : function (withoutSuffix) {
            return this.from(moment(), withoutSuffix);
        },

        calendar : function (time) {
            // We want to compare the start of today, vs this.
            // Getting start-of-today depends on whether we're zone'd or not.
            var now = time || moment(),
                sod = makeAs(now, this).startOf('day'),
                diff = this.diff(sod, 'days', true),
                format = diff < -6 ? 'sameElse' :
                    diff < -1 ? 'lastWeek' :
                    diff < 0 ? 'lastDay' :
                    diff < 1 ? 'sameDay' :
                    diff < 2 ? 'nextDay' :
                    diff < 7 ? 'nextWeek' : 'sameElse';
            return this.format(this.localeData().calendar(format, this));
        },

        isLeapYear : function () {
            return isLeapYear(this.year());
        },

        isDST : function () {
            return (this.zone() < this.clone().month(0).zone() ||
                this.zone() < this.clone().month(5).zone());
        },

        day : function (input) {
            var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
            if (input != null) {
                input = parseWeekday(input, this.localeData());
                return this.add(input - day, 'd');
            } else {
                return day;
            }
        },

        month : makeAccessor('Month', true),

        startOf : function (units) {
            units = normalizeUnits(units);
            // the following switch intentionally omits break keywords
            // to utilize falling through the cases.
            switch (units) {
            case 'year':
                this.month(0);
                /* falls through */
            case 'quarter':
            case 'month':
                this.date(1);
                /* falls through */
            case 'week':
            case 'isoWeek':
            case 'day':
                this.hours(0);
                /* falls through */
            case 'hour':
                this.minutes(0);
                /* falls through */
            case 'minute':
                this.seconds(0);
                /* falls through */
            case 'second':
                this.milliseconds(0);
                /* falls through */
            }

            // weeks are a special case
            if (units === 'week') {
                this.weekday(0);
            } else if (units === 'isoWeek') {
                this.isoWeekday(1);
            }

            // quarters are also special
            if (units === 'quarter') {
                this.month(Math.floor(this.month() / 3) * 3);
            }

            return this;
        },

        endOf: function (units) {
            units = normalizeUnits(units);
            return this.startOf(units).add(1, (units === 'isoWeek' ? 'week' : units)).subtract(1, 'ms');
        },

        isAfter: function (input, units) {
            units = typeof units !== 'undefined' ? units : 'millisecond';
            return +this.clone().startOf(units) > +moment(input).startOf(units);
        },

        isBefore: function (input, units) {
            units = typeof units !== 'undefined' ? units : 'millisecond';
            return +this.clone().startOf(units) < +moment(input).startOf(units);
        },

        isSame: function (input, units) {
            units = units || 'ms';
            return +this.clone().startOf(units) === +makeAs(input, this).startOf(units);
        },

        min: deprecate(
                 'moment().min is deprecated, use moment.min instead. https://github.com/moment/moment/issues/1548',
                 function (other) {
                     other = moment.apply(null, arguments);
                     return other < this ? this : other;
                 }
         ),

        max: deprecate(
                'moment().max is deprecated, use moment.max instead. https://github.com/moment/moment/issues/1548',
                function (other) {
                    other = moment.apply(null, arguments);
                    return other > this ? this : other;
                }
        ),

        // keepLocalTime = true means only change the timezone, without
        // affecting the local hour. So 5:31:26 +0300 --[zone(2, true)]-->
        // 5:31:26 +0200 It is possible that 5:31:26 doesn't exist int zone
        // +0200, so we adjust the time as needed, to be valid.
        //
        // Keeping the time actually adds/subtracts (one hour)
        // from the actual represented time. That is why we call updateOffset
        // a second time. In case it wants us to change the offset again
        // _changeInProgress == true case, then we have to adjust, because
        // there is no such time in the given timezone.
        zone : function (input, keepLocalTime) {
            var offset = this._offset || 0,
                localAdjust;
            if (input != null) {
                if (typeof input === 'string') {
                    input = timezoneMinutesFromString(input);
                }
                if (Math.abs(input) < 16) {
                    input = input * 60;
                }
                if (!this._isUTC && keepLocalTime) {
                    localAdjust = this._d.getTimezoneOffset();
                }
                this._offset = input;
                this._isUTC = true;
                if (localAdjust != null) {
                    this.subtract(localAdjust, 'm');
                }
                if (offset !== input) {
                    if (!keepLocalTime || this._changeInProgress) {
                        addOrSubtractDurationFromMoment(this,
                                moment.duration(offset - input, 'm'), 1, false);
                    } else if (!this._changeInProgress) {
                        this._changeInProgress = true;
                        moment.updateOffset(this, true);
                        this._changeInProgress = null;
                    }
                }
            } else {
                return this._isUTC ? offset : this._d.getTimezoneOffset();
            }
            return this;
        },

        zoneAbbr : function () {
            return this._isUTC ? 'UTC' : '';
        },

        zoneName : function () {
            return this._isUTC ? 'Coordinated Universal Time' : '';
        },

        parseZone : function () {
            if (this._tzm) {
                this.zone(this._tzm);
            } else if (typeof this._i === 'string') {
                this.zone(this._i);
            }
            return this;
        },

        hasAlignedHourOffset : function (input) {
            if (!input) {
                input = 0;
            }
            else {
                input = moment(input).zone();
            }

            return (this.zone() - input) % 60 === 0;
        },

        daysInMonth : function () {
            return daysInMonth(this.year(), this.month());
        },

        dayOfYear : function (input) {
            var dayOfYear = round((moment(this).startOf('day') - moment(this).startOf('year')) / 864e5) + 1;
            return input == null ? dayOfYear : this.add((input - dayOfYear), 'd');
        },

        quarter : function (input) {
            return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
        },

        weekYear : function (input) {
            var year = weekOfYear(this, this.localeData()._week.dow, this.localeData()._week.doy).year;
            return input == null ? year : this.add((input - year), 'y');
        },

        isoWeekYear : function (input) {
            var year = weekOfYear(this, 1, 4).year;
            return input == null ? year : this.add((input - year), 'y');
        },

        week : function (input) {
            var week = this.localeData().week(this);
            return input == null ? week : this.add((input - week) * 7, 'd');
        },

        isoWeek : function (input) {
            var week = weekOfYear(this, 1, 4).week;
            return input == null ? week : this.add((input - week) * 7, 'd');
        },

        weekday : function (input) {
            var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
            return input == null ? weekday : this.add(input - weekday, 'd');
        },

        isoWeekday : function (input) {
            // behaves the same as moment#day except
            // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
            // as a setter, sunday should belong to the previous week.
            return input == null ? this.day() || 7 : this.day(this.day() % 7 ? input : input - 7);
        },

        isoWeeksInYear : function () {
            return weeksInYear(this.year(), 1, 4);
        },

        weeksInYear : function () {
            var weekInfo = this.localeData()._week;
            return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
        },

        get : function (units) {
            units = normalizeUnits(units);
            return this[units]();
        },

        set : function (units, value) {
            units = normalizeUnits(units);
            if (typeof this[units] === 'function') {
                this[units](value);
            }
            return this;
        },

        // If passed a locale key, it will set the locale for this
        // instance.  Otherwise, it will return the locale configuration
        // variables for this instance.
        locale : function (key) {
            if (key === undefined) {
                return this._locale._abbr;
            } else {
                this._locale = moment.localeData(key);
                return this;
            }
        },

        lang : deprecate(
            "moment().lang() is deprecated. Use moment().localeData() instead.",
            function (key) {
                if (key === undefined) {
                    return this.localeData();
                } else {
                    this._locale = moment.localeData(key);
                    return this;
                }
            }
        ),

        localeData : function () {
            return this._locale;
        }
    });

    function rawMonthSetter(mom, value) {
        var dayOfMonth;

        // TODO: Move this out of here!
        if (typeof value === 'string') {
            value = mom.localeData().monthsParse(value);
            // TODO: Another silent failure?
            if (typeof value !== 'number') {
                return mom;
            }
        }

        dayOfMonth = Math.min(mom.date(),
                daysInMonth(mom.year(), value));
        mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
        return mom;
    }

    function rawGetter(mom, unit) {
        return mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]();
    }

    function rawSetter(mom, unit, value) {
        if (unit === 'Month') {
            return rawMonthSetter(mom, value);
        } else {
            return mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
        }
    }

    function makeAccessor(unit, keepTime) {
        return function (value) {
            if (value != null) {
                rawSetter(this, unit, value);
                moment.updateOffset(this, keepTime);
                return this;
            } else {
                return rawGetter(this, unit);
            }
        };
    }

    moment.fn.millisecond = moment.fn.milliseconds = makeAccessor('Milliseconds', false);
    moment.fn.second = moment.fn.seconds = makeAccessor('Seconds', false);
    moment.fn.minute = moment.fn.minutes = makeAccessor('Minutes', false);
    // Setting the hour should keep the time, because the user explicitly
    // specified which hour he wants. So trying to maintain the same hour (in
    // a new timezone) makes sense. Adding/subtracting hours does not follow
    // this rule.
    moment.fn.hour = moment.fn.hours = makeAccessor('Hours', true);
    // moment.fn.month is defined separately
    moment.fn.date = makeAccessor('Date', true);
    moment.fn.dates = deprecate('dates accessor is deprecated. Use date instead.', makeAccessor('Date', true));
    moment.fn.year = makeAccessor('FullYear', true);
    moment.fn.years = deprecate('years accessor is deprecated. Use year instead.', makeAccessor('FullYear', true));

    // add plural methods
    moment.fn.days = moment.fn.day;
    moment.fn.months = moment.fn.month;
    moment.fn.weeks = moment.fn.week;
    moment.fn.isoWeeks = moment.fn.isoWeek;
    moment.fn.quarters = moment.fn.quarter;

    // add aliased format methods
    moment.fn.toJSON = moment.fn.toISOString;

    /************************************
        Duration Prototype
    ************************************/


    function daysToYears (days) {
        // 400 years have 146097 days (taking into account leap year rules)
        return days * 400 / 146097;
    }

    function yearsToDays (years) {
        // years * 365 + absRound(years / 4) -
        //     absRound(years / 100) + absRound(years / 400);
        return years * 146097 / 400;
    }

    extend(moment.duration.fn = Duration.prototype, {

        _bubble : function () {
            var milliseconds = this._milliseconds,
                days = this._days,
                months = this._months,
                data = this._data,
                seconds, minutes, hours, years = 0;

            // The following code bubbles up values, see the tests for
            // examples of what that means.
            data.milliseconds = milliseconds % 1000;

            seconds = absRound(milliseconds / 1000);
            data.seconds = seconds % 60;

            minutes = absRound(seconds / 60);
            data.minutes = minutes % 60;

            hours = absRound(minutes / 60);
            data.hours = hours % 24;

            days += absRound(hours / 24);

            // Accurately convert days to years, assume start from year 0.
            years = absRound(daysToYears(days));
            days -= absRound(yearsToDays(years));

            // 30 days to a month
            // TODO (iskren): Use anchor date (like 1st Jan) to compute this.
            months += absRound(days / 30);
            days %= 30;

            // 12 months -> 1 year
            years += absRound(months / 12);
            months %= 12;

            data.days = days;
            data.months = months;
            data.years = years;
        },

        abs : function () {
            this._milliseconds = Math.abs(this._milliseconds);
            this._days = Math.abs(this._days);
            this._months = Math.abs(this._months);

            this._data.milliseconds = Math.abs(this._data.milliseconds);
            this._data.seconds = Math.abs(this._data.seconds);
            this._data.minutes = Math.abs(this._data.minutes);
            this._data.hours = Math.abs(this._data.hours);
            this._data.months = Math.abs(this._data.months);
            this._data.years = Math.abs(this._data.years);

            return this;
        },

        weeks : function () {
            return absRound(this.days() / 7);
        },

        valueOf : function () {
            return this._milliseconds +
              this._days * 864e5 +
              (this._months % 12) * 2592e6 +
              toInt(this._months / 12) * 31536e6;
        },

        humanize : function (withSuffix) {
            var output = relativeTime(this, !withSuffix, this.localeData());

            if (withSuffix) {
                output = this.localeData().pastFuture(+this, output);
            }

            return this.localeData().postformat(output);
        },

        add : function (input, val) {
            // supports only 2.0-style add(1, 's') or add(moment)
            var dur = moment.duration(input, val);

            this._milliseconds += dur._milliseconds;
            this._days += dur._days;
            this._months += dur._months;

            this._bubble();

            return this;
        },

        subtract : function (input, val) {
            var dur = moment.duration(input, val);

            this._milliseconds -= dur._milliseconds;
            this._days -= dur._days;
            this._months -= dur._months;

            this._bubble();

            return this;
        },

        get : function (units) {
            units = normalizeUnits(units);
            return this[units.toLowerCase() + 's']();
        },

        as : function (units) {
            var days, months;
            units = normalizeUnits(units);

            days = this._days + this._milliseconds / 864e5;
            if (units === 'month' || units === 'year') {
                months = this._months + daysToYears(days) * 12;
                return units === 'month' ? months : months / 12;
            } else {
                days += yearsToDays(this._months / 12);
                switch (units) {
                    case 'week': return days / 7;
                    case 'day': return days;
                    case 'hour': return days * 24;
                    case 'minute': return days * 24 * 60;
                    case 'second': return days * 24 * 60 * 60;
                    case 'millisecond': return days * 24 * 60 * 60 * 1000;
                    default: throw new Error('Unknown unit ' + units);
                }
            }
        },

        lang : moment.fn.lang,
        locale : moment.fn.locale,

        toIsoString : deprecate(
            "toIsoString() is deprecated. Please use toISOString() instead " +
            "(notice the capitals)",
            function () {
                return this.toISOString();
            }
        ),

        toISOString : function () {
            // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
            var years = Math.abs(this.years()),
                months = Math.abs(this.months()),
                days = Math.abs(this.days()),
                hours = Math.abs(this.hours()),
                minutes = Math.abs(this.minutes()),
                seconds = Math.abs(this.seconds() + this.milliseconds() / 1000);

            if (!this.asSeconds()) {
                // this is the same as C#'s (Noda) and python (isodate)...
                // but not other JS (goog.date)
                return 'P0D';
            }

            return (this.asSeconds() < 0 ? '-' : '') +
                'P' +
                (years ? years + 'Y' : '') +
                (months ? months + 'M' : '') +
                (days ? days + 'D' : '') +
                ((hours || minutes || seconds) ? 'T' : '') +
                (hours ? hours + 'H' : '') +
                (minutes ? minutes + 'M' : '') +
                (seconds ? seconds + 'S' : '');
        },

        localeData : function () {
            return this._locale;
        }
    });

    function makeDurationGetter(name) {
        moment.duration.fn[name] = function () {
            return this._data[name];
        };
    }

    for (i in unitMillisecondFactors) {
        if (unitMillisecondFactors.hasOwnProperty(i)) {
            makeDurationGetter(i.toLowerCase());
        }
    }

    moment.duration.fn.asMilliseconds = function () {
        return this.as('ms');
    };
    moment.duration.fn.asSeconds = function () {
        return this.as('s');
    };
    moment.duration.fn.asMinutes = function () {
        return this.as('m');
    };
    moment.duration.fn.asHours = function () {
        return this.as('h');
    };
    moment.duration.fn.asDays = function () {
        return this.as('d');
    };
    moment.duration.fn.asWeeks = function () {
        return this.as('weeks');
    };
    moment.duration.fn.asMonths = function () {
        return this.as('M');
    };
    moment.duration.fn.asYears = function () {
        return this.as('y');
    };

    /************************************
        Default Locale
    ************************************/


    // Set default locale, other locale will inherit from English.
    moment.locale('en', {
        ordinal : function (number) {
            var b = number % 10,
                output = (toInt(number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
            return number + output;
        }
    });

    /* EMBED_LOCALES */

    /************************************
        Exposing Moment
    ************************************/

    function makeGlobal(shouldDeprecate) {
        /*global ender:false */
        if (typeof ender !== 'undefined') {
            return;
        }
        oldGlobalMoment = globalScope.moment;
        if (shouldDeprecate) {
            globalScope.moment = deprecate(
                    'Accessing Moment through the global scope is ' +
                    'deprecated, and will be removed in an upcoming ' +
                    'release.',
                    moment);
        } else {
            globalScope.moment = moment;
        }
    }

    // CommonJS module is defined
    if (hasModule) {
        module.exports = moment;
    } else if (typeof define === 'function' && define.amd) {
        define('moment', function (require, exports, module) {
            if (module.config && module.config() && module.config().noGlobal === true) {
                // release the global variable
                globalScope.moment = oldGlobalMoment;
            }

            return moment;
        });
        makeGlobal(true);
    } else {
        makeGlobal();
    }
}).call(this);
// moment.js locale configuration
// locale : swedish (sv)
// author : Jens Alm : https://github.com/ulmus

(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define(['moment'], factory); // AMD
    } else if (typeof exports === 'object') {
        module.exports = factory(require('../moment')); // Node
    } else {
        factory(window.moment); // Browser global
    }
}(function (moment) {
    return moment.defineLocale('sv', {
        months : "januari_februari_mars_april_maj_juni_juli_augusti_september_oktober_november_december".split("_"),
        monthsShort : "jan_feb_mar_apr_maj_jun_jul_aug_sep_okt_nov_dec".split("_"),
        weekdays : "söndag_måndag_tisdag_onsdag_torsdag_fredag_lördag".split("_"),
        weekdaysShort : "sön_mån_tis_ons_tor_fre_lör".split("_"),
        weekdaysMin : "sö_må_ti_on_to_fr_lö".split("_"),
        longDateFormat : {
            LT : "HH:mm",
            L : "YYYY-MM-DD",
            LL : "D MMMM YYYY",
            LLL : "D MMMM YYYY LT",
            LLLL : "dddd D MMMM YYYY LT"
        },
        calendar : {
            sameDay: '[Idag] LT',
            nextDay: '[Imorgon] LT',
            lastDay: '[Igår] LT',
            nextWeek: 'dddd LT',
            lastWeek: '[Förra] dddd[en] LT',
            sameElse: 'L'
        },
        relativeTime : {
            future : "om %s",
            past : "för %s sedan",
            s : "några sekunder",
            m : "en minut",
            mm : "%d minuter",
            h : "en timme",
            hh : "%d timmar",
            d : "en dag",
            dd : "%d dagar",
            M : "en månad",
            MM : "%d månader",
            y : "ett år",
            yy : "%d år"
        },
        ordinal : function (number) {
            var b = number % 10,
                output = (~~(number % 100 / 10) === 1) ? 'e' :
                (b === 1) ? 'a' :
                (b === 2) ? 'a' :
                (b === 3) ? 'e' : 'e';
            return number + output;
        },
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });
}));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('MMMM D, YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
