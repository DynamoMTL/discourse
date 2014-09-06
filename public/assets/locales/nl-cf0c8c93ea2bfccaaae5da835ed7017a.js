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
MessageFormat.locale.nl = function ( n ) {
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
r += "Er ";
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
r += "is <a href='/unread'>1 ongelezen</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "zijn <a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " ongelezen</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += " <a href='/new'>1 nieuwe</a> topic";
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
r += "zijn ";
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
})() + " nieuwe</a> topics";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " over, of ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "bekijk andere topics in ";
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
}});I18n.translations = {"nl":{"js":{"number":{"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}}},"dates":{"time":"h:mm a","long_no_year":"MMM D h:mm a","long_no_year_no_time":"MMM D","long_with_year":"MMM D, YYYY h:mm a","long_with_year_no_time":"MMM D, YYYY","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c 1s","other":"\u003c %{count}s"},"x_seconds":{"one":"1s","other":"%{count}s"},"less_than_x_minutes":{"one":"\u003c 1m","other":"\u003c %{count}m"},"x_minutes":{"one":"1m","other":"%{count}m"},"about_x_hours":{"one":"1h","other":"%{count}u"},"x_days":{"one":"1d","other":"%{count}d"},"about_x_years":{"one":"1j","other":"%{count}j"},"over_x_years":{"one":"\u003e 1j","other":"\u003e %{count}j"},"almost_x_years":{"one":"1j","other":"%{count}j"},"date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"1 min","other":"%{count} mins"},"x_hours":{"one":"1 uur","other":"%{count} uren"},"x_days":{"one":"1 dag","other":"%{count} dagen"}},"medium_with_ago":{"x_minutes":{"one":"1 min geleden","other":"%{count} mins geleden"},"x_hours":{"one":"1 uur geleden","other":"%{count} uren geleden"},"x_days":{"one":"1 day geleden","other":"%{count} dagen geleden"}}},"share":{"topic":"deel een link naar deze topic","post":"deel een link naar bericht #%{postNumber}","close":"sluit","twitter":"deel deze link op Twitter","facebook":"deel deze link op Facebook","google+":"deel deze link op Google+","email":"deel deze link via e-mail"},"edit":"bewerk de titel en categorie van deze topic","not_implemented":"Die functie is helaas nog niet beschikbaar. Sorry!","no_value":"Nee","yes_value":"Ja","generic_error":"Sorry, er is iets fout gegaan.","generic_error_with_reason":"Er is iets fout gegaan: %{error}","sign_up":"Aanmelden","log_in":"Inloggen","age":"Leeftijd","joined":"Lid sinds","admin_title":"Beheer","flags_title":"Meldingen","show_more":"meer...","links":"Links","links_lowercase":"links","faq":"FAQ","guidelines":"Richtlijnen","privacy_policy":"Privacy Policy","privacy":"Privacy","terms_of_service":"Algemene Voorwaarden","mobile_view":"Mobiele versie","desktop_view":"Desktop weergave","you":"Jij","or":"of","now":"zonet","read_more":"lees verder","more":"Meer","less":"Minder","never":"nooit","daily":"dagelijks","weekly":"wekelijks","every_two_weeks":"elke twee weken","max":"max","character_count":{"one":"{{count}} teken","other":"{{count}} tekens"},"in_n_seconds":{"one":"over 1 seconde","other":"over {{count}} seconden"},"in_n_minutes":{"one":"over 1 minuut","other":"over {{count}} minuten"},"in_n_hours":{"one":"over 1 uur","other":"over {{count}} uren"},"in_n_days":{"one":"over 1 dag","other":"over {{count}} dagen"},"suggested_topics":{"title":"Aanbevolen topics"},"about":{"simple_title":"Over","title":"Over %{title}","stats":"Site statistieken","our_admins":"Onze beheerders","our_moderators":"Onze moderators","stat":{"all_time":"Sinds het begin","last_7_days":"Afgelopen 7 dagen"},"like_count":"Aantal likes","topic_count":"Aantal topics","post_count":"Aantal berichten","user_count":"Aantal gebruikers"},"bookmarks":{"not_logged_in":"sorry, je moet ingelogd zijn om berichten aan je favorieten toe te kunnen voegen","created":"je hebt dit bericht aan je favorieten toegevoegd","not_bookmarked":"je hebt dit bericht gelezen; klik om het aan je favorieten toe te voegen","last_read":"dit is het laatste bericht dat je gelezen hebt; klik om het aan je favorieten toe te voegen","remove":"Verwijder favoriet"},"topic_count_latest":{"one":"{{count}} nieuwe of aangepaste discussie.","other":"{{count}} nieuwe of aangepaste discussies."},"topic_count_unread":{"one":"{{count}} ongelezen discussie.","other":"{{count}} ongelezen discussies."},"topic_count_new":{"one":"{{count}} nieuwe discussie. ","other":"{{count}} nieuwe discussies."},"click_to_show":"Klik om te bekijken.","preview":"voorbeeld","cancel":"annuleer","save":"Bewaar wijzigingen","saving":"Wordt opgeslagen...","saved":"Opgeslagen!","upload":"Upload","uploading":"Uploaden...","uploaded":"Geupload!","enable":"Inschakelen","disable":"Uitschakelen","undo":"Herstel","revert":"Zet terug","banner":{"close":"Verberg deze banner."},"choose_topic":{"none_found":"Geen topics gevonden.","title":{"search":"Zoek naar een topic op naam, url of id:","placeholder":"typ hier de titel van de topic"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e plaatste \u003ca href='{{topicUrl}}'\u003edeze topic\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eJij\u003c/a\u003e plaatste \u003ca href='{{topicUrl}}'\u003edeze topic\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e reageerde op \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eJij\u003c/a\u003e reageerde op \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e reageerde op \u003ca href='{{topicUrl}}'\u003ethe topic\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eJij\u003c/a\u003e reageerde op \u003ca href='{{topicUrl}}'\u003ethe topic\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e noemde \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e noemde \u003ca href='{{user2Url}}'\u003ejou\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eJij\u003c/a\u003e noemde \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Geplaatst door \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Geplaatst door \u003ca href='{{userUrl}}'\u003ejou\u003c/a\u003e","sent_by_user":"Verzonden door \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Verzonden door \u003ca href='{{userUrl}}'\u003ejou\u003c/a\u003e"},"groups":{"visible":"Groep is zichtbaar voor alle gebruikers","title":{"one":"groep","other":"groepen"},"members":"Leden","posts":"Berichten","alias_levels":{"title":"Wie kan deze groep als alias gebruiken?","nobody":"Niemand","only_admins":"Alleen admins","mods_and_admins":"Alleen moderatoren and admins","members_mods_and_admins":"Alleen leden van de groep, moderatoren en admins","everyone":"Iedereen"}},"user_action_groups":{"1":"Likes gegeven","2":"Likes ontvangen","3":"Bladwijzers","4":"Topics","5":"Berichten","6":"Reacties","7":"Genoemd","9":"Citaten","10":"Met ster","11":"Wijzigingen","12":"Verzonden items","13":"Inbox"},"categories":{"all":"alle categorieën","all_subcategories":"alle","no_subcategory":"geen","category":"Categorie","posts":"Berichten","topics":"Topics","latest":"Laatste","latest_by":"Laatste door","toggle_ordering":"schakel sorteermethode","subcategories":"Subcategorieën","topic_stats":"The number of new topics.","topic_stat_sentence":{"one":"%{count} nieuw topic in de afgelopen %{unit}.","other":"%{count} nieuwe topics in de afgelopen %{unit}."},"post_stats":"Het aantal nieuwe berichten.","post_stat_sentence":{"one":"%{count} nieuw bericht in de afgelopen %{unit}.","other":"%{count} nieuwe berichten in de afgelopen %{unit}."}},"ip_lookup":{"title":"IP-adres lookup","hostname":"Hostname","location":"Locatie","location_not_found":"(onbekend)","organisation":"Organisatie","phone":"Telefoon","other_accounts":"Andere accounts met dit IP-adres","no_other_accounts":"(geen)"},"user":{"said":"{{username}} zei:","profile":"Profiel","mute":"Negeer","edit":"Wijzig voorkeuren","download_archive":"download een archief van mijn berichten","private_message":"Privébericht","private_messages":"Berichten","activity_stream":"Activiteit","preferences":"Voorkeuren","bookmarks":"Bladwijzers","bio":"Over mij","invited_by":"Uitgenodigd door","trust_level":"Trustlevel","notifications":"Notificaties","disable_jump_reply":"Niet naar je nieuwe bericht gaan na reageren","dynamic_favicon":"Laat notificatie voor nieuw bericht zien in favicon (experiment)","edit_history_public":"Laat andere gebruikers mijn aanpassingen aan dit bericht zien.","external_links_in_new_tab":"Open alle externe links in een nieuw tabblad","enable_quoting":"Activeer antwoord-met-citaat voor geselecteerde tekst","change":"verander","moderator":"{{user}} is een moderator","admin":"{{user}} is een beheerder","moderator_tooltip":"Deze gebruiker is een moderator","admin_tooltip":"Deze gebruiker is een admin","suspended_notice":"Deze gebruiker is geschorst tot {{date}}.","suspended_reason":"Reden: ","watched_categories":"In de gaten gehouden","watched_categories_instructions":"Je krijgt bericht van alle nieuwe berichten en topics in deze categoriën, daarnaast zal het aantal ongelezen en nieuwe berichten naast de topiclijst verschijnen.","tracked_categories":"Gevolgd","tracked_categories_instructions":"Het aantal ongelezen en nieuwe berichten in deze categoriën zal naast de topiclijst verschijnen","muted_categories":"Genegeerd","muted_categories_instructions":"Je zal geen notificaties krijgen over nieuwe topics en berichten in deze categoriën","delete_account":"Verwijder mijn account","delete_account_confirm":"Weet je zeker dat je je account definitief wil verwijderen? Dit kan niet meer ongedaan gemaakt worden!","deleted_yourself":"Je account is verwijderd.","delete_yourself_not_allowed":"Je kan je account nu niet verwijderen. Neem contact op met een admin om je account te laten verwijderen.","unread_message_count":"Berichten","staff_counters":{"flags_given":"behulpzame markeringen","flagged_posts":"gemarkeerde berichten","deleted_posts":"verwijderde berichten","suspensions":"schorsingen"},"messages":{"all":"Alle","mine":"Mijn","unread":"Ongelezen"},"change_password":{"success":"(e-mail verzonden)","in_progress":"(e-mail wordt verzonden)","error":"(fout)","action":"Stuur wachtwoord-reset-mail","set_password":"Stel wachtwoord in"},"change_about":{"title":"Wijzig bio"},"change_username":{"title":"Wijzig gebruikersnaam","confirm":"Het wijzigen van je gebruikersnaam kan consequenties hebben. Weet je zeker dat je dit wil doen?","taken":"Sorry, maar die gebruikersnaam is al in gebruik.","error":"Het wijzigen van je gebruikersnaam is mislukt.","invalid":"Die gebruikersnaam is ongeldig. Gebruik alleen nummers en letters."},"change_email":{"title":"Wijzig e-mail","taken":"Sorry, dat e-mailadres is niet beschikbaar.","error":"Het veranderen van je e-mailadres is mislukt. Misschien is deze al in gebruik?","success":"We hebben een mail gestuurd naar dat adres. Volg de bevestigingsinstructies in die mail."},"change_avatar":{"title":"Wijzig je avatar","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, gebaseerd op","refresh_gravatar_title":"Laad je Gravatar opnieuw","letter_based":"Automatisch aangemaakte avatar","uploaded_avatar":"Eigen afbeelding","uploaded_avatar_empty":"Voeg een eigen afbeelding toe","upload_title":"Upload je afbeelding","upload_picture":"Upload afbeelding","image_is_not_a_square":"Let op: we hebben je afbeelding bijgesneden; het is geen vierkant."},"change_profile_background":{"title":"Profielachtergrond"},"email":{"title":"E-mail","ok":"Prima. We zullen je een e-mail sturen ter bevestiging.","invalid":"Vul een geldig e-mailadres in.","authenticated":"Je e-mailadres is bevestigd door {{provider}}.","frequency":"We zullen je alleen maar mailen als we je een tijd niet gezien hebben, en als je toevallig hetgeen waarover we je mailen nog niet hebt gezien op onze site."},"name":{"title":"Naam","too_short":"Je naam is te kort.","ok":"Je naam ziet er prima uit."},"username":{"title":"Gebruikersnaam","short_instructions":"Mensen kunnen naar je verwijzen als @{{username}}.","available":"Je gebruikersnaam is beschikbaar.","global_match":"Je e-mailadres komt overeen met je geregistreerde gebruikersnaam.","global_mismatch":"Is al geregistreerd. Gebruikersnaam {{suggestion}} proberen?","not_available":"Niet beschikbaar. Gebruikersnaam {{suggestion}} proberen?","too_short":"Je gebruikersnaam is te kort.","too_long":"Je gebruikersnaam is te lang.","checking":"Kijken of gebruikersnaam beschikbaar is...","enter_email":"Gebruikersnaam gevonden. Vul het gekoppelde e-mailadres in.","prefilled":"E-mail hoort bij deze gebruikersnaam."},"locale":{"title":"Interfacetaal","default":"(standaard)"},"password_confirmation":{"title":"Nogmaals het wachtwoord"},"last_posted":"Laatste bericht","last_emailed":"Laatst gemaild","last_seen":"Gezien","created":"Lid sinds","log_out":"Uitloggen","location":"Locatie","website":"Website","email_settings":"E-mail","email_digests":{"title":"Ontvang een mail met de laatste updates wanneer je de site niet bezoekt.","daily":"dagelijks","weekly":"wekelijks","bi_weekly":"elke twee weken"},"email_direct":"Ontvang een mail wanneer iemand je citeert, reageert op je bericht of je @gebruikersnaam noemt.","email_private_messages":"Ontvang een mail wanneer iemand je een privébericht heeft gestuurd.","other_settings":"Overige","categories_settings":"Categorieën","new_topic_duration":{"label":"Beschouw topics als nieuw wanneer","not_viewed":"je hebt ze nog niet bekeken","last_here":"gemaakt sinds de vorige keer dat je hier was","after_n_days":{"one":"gemaakt gisteren","other":"gemaakt in de afgelopen {{count}} dagen"},"after_n_weeks":{"one":"gemaakt in de afgelopen week","other":"gemaakt in de afgelopen {{count}} weken"}},"auto_track_topics":"Houd automatisch topics bij die je bezoekt","auto_track_options":{"never":"nooit","always":"altijd","after_n_seconds":{"one":"na één seconde","other":"na {{count}} seconden"},"after_n_minutes":{"one":"na één minuut","other":"na {{count}} minuten"}},"invited":{"search":"Typ om uitnodigingen te zoeken...","title":"Uitnodigingen","user":"Uitgenodigd lid","none":"Je hebt nog niemand uitgenodigd.","truncated":"De eerste {{count}} uitnodigingen.","redeemed":"Verzilverde uitnodigingen","redeemed_at":"Verzilverd","pending":"Uitstaande uitnodigingen","topics_entered":"Topics bekeken","posts_read_count":"Berichten gelezen","expired":"Deze uitnodiging is verlopen.","rescind":"Verwijder","rescinded":"Uitnodiging verwijderd","time_read":"Leestijd","days_visited":"Dagen bezocht","account_age_days":"leeftijd van account in dagen","create":"Stuur een uitnodiging","bulk_invite":{"none":"Je hebt nog niemand uitgenodigd. Je kan individueel uitnodigen of een groep mensen tegelijk door \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003eeen groepsuitnodiging-bestand te uploaden\u003c/a\u003e","text":"Groepsuitnodiging van bestan","uploading":"UPLOADEN","success":"Het uploaden van het bestand is gelukt, over enkele momenten krijg je meer informatie over de voortgang","error":"Het uploaden van '{{filename}}' is niet gelukt: {{message}}"}},"password":{"title":"Wachtwoord","too_short":"Je wachtwoord is te kort.","common":"Dat wachtwoord wordt al te vaak gebruikt.","ok":"Je wachtwoord ziet er goed uit.","instructions":"Moet te minste uit %{count} tekens bestaan."},"ip_address":{"title":"Laatste IP-adres"},"registration_ip_address":{"title":"Registratie IP-adres"},"avatar":{"title":"Profielfoto"},"title":{"title":"Titel"},"filters":{"all":"Alle"},"stream":{"posted_by":"Geplaatst door","sent_by":"Verzonden door","private_message":"privébericht","the_topic":"de topic"}},"loading":"Laden...","errors":{"prev_page":"tijdens het uploaden","reasons":{"network":"Netwerk Fout","unknown":"Fout"},"desc":{"network":"Controleer je verbinding","network_fixed":"Het lijkt er op dat het terug is","unknown":"Er is iets mis gegaan"},"buttons":{"back":"Ga terug","again":"Probeer opnieuw","fixed":"Pagina laden"}},"close":"Sluit","assets_changed_confirm":"Discourse is bijgewerkt, will je een refresh doen om de laatste versie te laden?","read_only_mode":{"enabled":"Dit forum is in read-only modus. Je kan rondkijken, maar sommige elementen zullen mogelijk niet goed werken.","login_disabled":"Zolang de site in read-only modus is, kan er niet ingelogd worden."},"learn_more":"leer meer...","year":"jaar","year_desc":"topics die in de afgelopen 365 dagen gemaakt zijn","month":"maand","month_desc":"topics die in de afgelopen 30 dagen gemaakt zijn","week":"week","week_desc":"topics die in de afgelopen 7 dagen gemaakt zijn","day":"dag","first_post":"Eerste bericht","mute":"Negeer","unmute":"Tonen","last_post":"Laatste bericht","last_post_lowercase":"laatste bericht","summary":{"description":"Er zijn \u003cb\u003e{{count}}\u003c/b\u003e reacties.","description_time":"Er zijn \u003cb\u003e{{count}}\u003c/b\u003e reacties met een gemiddelde leestijd van \u003cb\u003e{{readingTime}} minuten\u003c/b\u003e.","enable":"Samenvatting van topic","disable":"Alle berichten"},"deleted_filter":{"enabled_description":"Deze discussie bevat verwijderde berichten, die niet getoond worden","disabled_description":"Verwijderde berichten in deze discussie worden getoond.","enable":"Verberg Verwijderde Berichten","disable":"Toon Verwijderde Berichten"},"private_message_info":{"title":"Privébericht","invite":"Nodig anderen uit...","remove_allowed_user":"Weet je zeker dat je {{name}} wil verwijderen uit deze priveconversatie?"},"email":"E-mail","username":"Gebruikersnaam","last_seen":"Gezien","created":"Gemaakt","created_lowercase":"gemaakt","trust_level":"Trustlevel","search_hint":"gebruikersnaam of e-mail","create_account":{"title":"Maak een nieuw account","failed":"Er ging iets mis, wellicht is het e-mailadres al geregistreerd. Probeer de 'Wachtwoord vergeten'-link."},"forgot_password":{"title":"Wachtwoord vergeten","action":"Ik ben mijn wachtwoord vergeten","invite":"Vul je gebruikersnaam of e-mailadres in en we sturen je een wachtwoord-herstel-mail.","reset":"Herstel wachtwoord","complete_username":"Als er een account gevonden kan worden met gebruikersnaam \u003cb\u003e%{username}\u003cb/\u003e dan zul je in een ogenblik een wachtwoord-herstel-mail ontvangen.","complete_email":"Als er een account gevonden kan worden met het emailadres \u003cb\u003e%{email}\u003cb/\u003e dan zul je in een ogenblik een wachtwoord-herstel-mail ontvangen."},"login":{"title":"Inloggen","username":"Gebruiker","password":"Wachtwoord","email_placeholder":"e-mail of gebruikersnaam","caps_lock_warning":"Caps Lock staat aan","error":"Er is een onbekende fout opgetreden","blank_username_or_password":"Vul je email of gebruikersnaam in en je wachtwoord.","reset_password":"Herstel wachtwoord","logging_in":"Inloggen...","or":"Of","authenticating":"Authenticatie...","awaiting_confirmation":"Je account is nog niet geactiveerd. Gebruik de 'Wachtwoord vergeten'-link om een nieuwe activatiemail te ontvangen.","awaiting_approval":"Je account is nog niet goedgekeurd door iemand van de staf. Je krijgt van ons een mail wanneer dat gebeurd is.","requires_invite":"Toegang tot dit forum is alleen op uitnodiging.","not_activated":"Je kan nog niet inloggen. We hebben je een activatie-mail gestuurd (naar \u003cb\u003e{{sentTo}}\u003c/b\u003e). Volg de instructies in die mail om je account te activeren.","resend_activation_email":"Klik hier om de activatiemail opnieuw te ontvangen.","sent_activation_email_again":"We hebben een nieuwe activatiemail gestuurd naar \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Het kan een aantal minuten duren voor deze aan komt. Check ook je spamfolder.","google":{"title":"met Google","message":"Inloggen met een Google-account (zorg ervoor dat je popup blocker uit staat)"},"google_oauth2":{"title":"met Google","message":"Authenticeren met Google (zorg er voor dat popup-blockers uit staan)"},"twitter":{"title":"met Twitter","message":"Inloggen met een Twitteraccount (zorg ervoor dat je popup blocker uit staat)"},"facebook":{"title":"met Facebook","message":"Inloggen met een Facebookaccount (zorg ervoor dat je popup blocker uit staat)"},"yahoo":{"title":"met Yahoo","message":"Inloggen met een Yahoo-account (zorg ervoor dat je popup blocker uit staat)"},"github":{"title":"met Github","message":"Inloggen met een Githubaccount (zorg ervoor dat je popup blocker uit staat)"}},"composer":{"posting_not_on_topic":"In welke topic wil je je antwoord plaatsen?","saving_draft_tip":"wordt opgeslagen","saved_draft_tip":"opgeslagen","saved_local_draft_tip":"lokaal opgeslagen","similar_topics":"Jouw topic lijkt op...","drafts_offline":"concepten offline","min_length":{"need_more_for_title":"Nog {{n}} tekens nodig voor de titel","need_more_for_reply":"Nog {{n}} tekens nodig voor het bericht"},"error":{"title_missing":"Titel is verplicht","title_too_short":"Titel moet uit minstens {{min}} tekens bestaan","title_too_long":"Titel kan niet langer dan {{max}} tekens zijn","post_missing":"Bericht kan niet leeg zijn","post_length":"Bericht moet ten minste {{min}} tekens bevatten","category_missing":"Je moet nog een categorie kiezen"},"save_edit":"Bewaar wijzigingen","reply_original":"Reageer op oorspronkelijke topic","reply_here":"Reageer hier","reply":"Reageer","cancel":"Annuleer","create_topic":"Maak topic","create_pm":"Maak privébericht","title":"Of druk op Ctrl-Return","users_placeholder":"Voeg een lid toe","title_placeholder":"Waar gaat de discussie over in één korte zin?","edit_reason_placeholder":"vanwaar de wijziging?","show_edit_reason":"(geef een reden)","reply_placeholder":"Schrijf hier je bericht. Gebruik Markdown of BBCode voor de tekstopmaak. Sleep of plak een afbeelding hierin om deze te uploaden.\"","view_new_post":"Bekijk je nieuwe bericht.","saving":"Opslaan...","saved":"Opgeslagen!","saved_draft":"Je bent bezig met een conceptbericht. Klik op deze balk om verder te gaan met schrijven.","uploading":"Uploaden...","show_preview":"toon voorbeeld \u0026raquo;","hide_preview":"\u0026laquo; verberg voorbeeld","quote_post_title":"Citeer hele bericht","bold_title":"Vet","bold_text":"Vetgedrukte tekst","italic_title":"Cursief","italic_text":"Cursieve tekst","link_title":"Weblink","link_description":"geef hier een omschrijving","link_dialog_title":"Voeg weblink toe","link_optional_text":"optionele titel","quote_title":"Citaat","quote_text":"Citaat","code_title":"Opgemaakte tekst","code_text":"zet 4 spaties voor opgemaakte tekst","upload_title":"Afbeelding","upload_description":"geef een omschrijving voor de afbeelding op","olist_title":"Genummerde lijst","ulist_title":"Lijst met bullets","list_item":"Lijstonderdeel","heading_title":"Kop","heading_text":"Kop","hr_title":"Horizontale lijn","undo_title":"Herstel","redo_title":"Opnieuw","help":"Uitleg over Markdown","toggler":"verberg of toon de editor","admin_options_title":"Optionele stafinstellingen voor deze topic","auto_close_label":"Sluit topic automatisch:","auto_close_units":"(# uren, een tijd of een volledige datum en tijd)","auto_close_examples":"voer absoluut tijdstip of aantal uur in — 24, 17:00, 2013-11-22 14:00","auto_close_error":"Vul een geldige waarde in."},"notifications":{"title":"notificaties van @naam vermeldingen, reacties op je berichten en topics, privé-berichten, etc.","none":"Er zijn nu geen notificaties.","more":"bekijk oudere notificaties","total_flagged":"aantal gemarkeerde berichten","mentioned":"\u003ci title='genoemd' class='icon'\u003e@\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='geciteerd' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='beantwoord' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='beantwoord' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='aangepast' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='geliked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","private_message":"\u003ci title='privebericht' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='privebericht' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='heeft jouw uitnodiging geaccepteerd' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e accepted your invitation\u003c/p\u003e","moved_post":"\u003ci title='heeft bericht verplaatst' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e moved {{description}}\u003c/p\u003e","linked":"\u003ci title='gelinkt bericht' class='fa fa-arrow-left'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e"},"upload_selector":{"title":"Voeg een afbeelding toe","title_with_attachments":"Voeg een afbeelding of bestand toe","from_my_computer":"Vanaf mijn apparaat","from_the_web":"Vanaf het web","remote_tip":"link naar afbeelding http://example.com/image.jpg","remote_tip_with_attachments":"vul een url in van een afbeelding of bestand: http://example.com/file.ext (toegestane extensies: {{authorized_extensions}}).","local_tip":"klik om een afbeelding vanaf je apparaat te selecteren.","local_tip_with_attachments":"klik om een afbeelding of bestand vanaf je apparaat te selecteren (toegestane extensies: {{authorized_extensions}}).","hint":"(je kan afbeeldingen ook slepen in de editor om deze te uploaden)","hint_for_supported_browsers":"(je kan ook afbeeldingen hierheen slepen of copy/pasten om ze te uploaden)","uploading":"Uploaden","image_link":"de link waar je afbeelding naar verwijst"},"search":{"title":"zoek naar topics, berichten, gebruikers of categorieën","no_results":"Geen resultaten gevonden.","searching":"Zoeken...","context":{"user":"Zoek berichten van @{{username}}","category":"Zoek door de \"{{category}}\" categorie","topic":"Zoek in deze topic"}},"site_map":"ga naar een andere topiclijst of categorie","go_back":"ga terug","not_logged_in_user":"gebruikerspagina met samenvatting van de activiteiten en voorkeuren","current_user":"ga naar je gebruikerspagina","starred":{"title":"Ster","help":{"star":"Markeer deze topic met een ster om makkelijk terug te vinden","unstar":"Verwijder de stermarkering van deze topic"}},"topics":{"bulk":{"reset_read":"markeer als ongelezen","delete":"Verwijder discussies","dismiss_posts":"Verwijder berichten","dismiss_posts_tooltip":"Reset de teller voor ongelezen berichten voor deze discussies, maar houd ze wel in mijn lijst van ongelezen discussies als er nieuwe berichten worden toegevoegd.","dismiss_topics":"Verwijder discussies","dismiss_topics_tooltip":"Laat deze discussies niet meer zien in mijn ongelezen discussielijst wanneer nieuwe berichten worden geplaatst.","dismiss_new":"markeer nieuwe berichten als gelezen","toggle":"selecteer meerdere topics tegelijkertijd","actions":"Bulk Acties","change_category":"Wijzig categorie","close_topics":"Sluit topics","notification_level":"Wijzig notificatielevel","selected":{"one":"Je hebt \u003cb\u003e1\u003c/b\u003e topic geselecteerd.","other":"Je hebt \u003cb\u003e{{count}}\u003c/b\u003e topics geselecteerd."}},"none":{"starred":"Je hebt nog geen topics met een ster. Om een topic aan deze lijst toe te voegen, klik of druk je op de ster naast de topictitel.","unread":"Je hebt geen ongelezen topics.","new":"Je hebt geen nieuwe topics.","read":"Je hebt nog geen topics gelezen.","posted":"Je hebt nog niet in een topic gereageerd.","latest":"Er zijn geen populaire topics. Dat is jammer.","hot":"Er zijn geen polulaire topics.","category":"Er zijn geen topics in {{category}}.","top":"Er zijn geen top-topics.","educate":{"new":"\u003cp\u003eStandaard worden discussies als nieuw beschouwd als ze gemaakt zijn in de afgelopen 2 dagen.\u003c/p\u003e\u003cp\u003eJe kan dit aanpassen in je \u003ca href=\"%{userPrefsUrl}\"\u003evoorkeuren\u003c/a\u003e.\u003c/p\u003e","unread":"\u003cp\u003eStandaard worden discussies alleen als ongelezen getoond als je ze hebt:\u003c/p\u003e\u003cul\u003e\u003cli\u003eGemaakt\u003c/li\u003e\u003cli\u003eBeantwoord\u003c/li\u003e\u003cli\u003eMeer dan 4 minuten hebt gelezen\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eOf als je de discussie expliciet hebt gemarkeerd als Te Volgen via de notificatieknop onder aan de pagina van elke discussie.\u003c/p\u003e\u003cp\u003eJe kan dit aanpassen in je \u003ca href=\"%{userPrefsUrl}\"\u003einstellingen\u003c/a\u003e.\u003c/p\u003e"}},"bottom":{"latest":"Er zijn geen recente topics.","hot":"Er zijn geen polulaire topics meer.","posted":"Er zijn geen geplaatste topics meer.","read":"Er zijn geen gelezen topics meer.","new":"Er zijn geen nieuwe topics meer.","unread":"Er zijn geen ongelezen topics meer.","starred":"Er zijn geen topics met een ster meer.","category":"Er zijn geen topics meer in {{category}}.","top":"Er zijn geen top-topics meer."}},"topic":{"filter_to":"{{post_count}} berichten in topic","create":"Maak topic","create_long":"Maak een nieuw topic","private_message":"Stuur een privébericht","list":"Topics","new":"nieuw topic","unread":"ongelezen","new_topics":{"one":"1 nieuwe topic","other":"{{count}} nieuwe topics"},"unread_topics":{"one":"1 ongelezen topic","other":"{{count}} ongelezen topics"},"title":"Topic","loading_more":"Er worden meer topics geladen...","loading":"Bezig met laden van topic...","invalid_access":{"title":"Topic is privé","description":"Sorry, je hebt geen toegang tot deze topic.","login_required":"Je moet inloggen om deze discussie te kunnen lezen."},"server_error":{"title":"Laden van topic is mislukt","description":"Sorry, we konden deze topic niet laden, waarschijnlijk door een verbindingsprobleem. Probeer het later opnieuw. Als het probleem blijft, laat het ons dan weten."},"not_found":{"title":"Topic niet gevonden","description":"Sorry, we konden de opgevraagde topic niet vinden. Wellicht is het verwijderd door een moderator?"},"total_unread_posts":{"one":"je hebt 1 ongelezen bericht in deze discussie","other":"je hebt {{count}} ongelezen berichten in deze discussie"},"unread_posts":{"one":"je hebt 1 ongelezen bericht in deze topic","other":"je hebt {{count}} ongelezen berichten in deze topic"},"new_posts":{"one":"er is 1 nieuw bericht in deze topic sinds je deze voor het laatst gelezen hebt","other":"er zijn {{count}} nieuwe berichten in deze topic sinds je deze voor het laatst gelezen hebt"},"likes":{"one":"er is één waardering in deze topic","other":"er zijn {{likes}} waarderingen in deze topic"},"back_to_list":"Terug naar topiclijst","options":"Topic-opties","show_links":"laat links in deze topic zien","toggle_information":"Zet topic details aan/uit","read_more_in_category":"Wil je meer lezen? Kijk dan voor andere topics in {{catLink}} of {{latestLink}}.","read_more":"Wil je meer lezen? {{catLink}} of {{latestLink}}.","browse_all_categories":"Bekijk alle categorieën","view_latest_topics":"bekijk nieuwste topics","suggest_create_topic":"Wil je een nieuwe topic schrijven?","jump_reply_up":"ga naar een eerdere reactie","jump_reply_down":"ga naar een latere reactie","deleted":"Deze topic is verwijderd","auto_close_notice":"Deze topic wordt automatisch over %{timeLeft} gesloten.","auto_close_title":"Instellingen voor automatisch sluiten","auto_close_save":"Opslaan","auto_close_remove":"Sluit deze topic niet automatisch","progress":{"title":"topic voortgang","go_top":"top","go_bottom":"onderkant","go":"ga","jump_bottom_with_number":"spring naar bericht %{post_number}","total":"totaal aantal berichten","current":"huidige bericht","position":"bericht %{current} van %{total}"},"notifications":{"reasons":{"3_6":"Je ontvangt notificaties omdat je deze categorie in de gaten houdt.","3_5":"Je ontvangt notificaties omdat je deze topic automatisch in de gaten houdt.","3_2":"Je ontvangt notificaties omdat je deze topic in de gaten houdt.","3_1":"Je ontvangt notificaties omdat jij deze topic gemaakt hebt.","3":"Je ontvangt notificaties omdat je deze topic in de gaten houdt.","2_8":"Je krijg een melding omdat je dit topic volgt.","2_4":"Je ontvangt notificaties omdat je een reactie aan deze topic hebt geplaatst.","2_2":"Je ontvangt notificaties omdat je deze topic volgt.","2":"Je ontvangt notificaties omdat je \u003ca href=\"/users/{{username}}/preferences\"\u003edeze topic hebt gelezen\u003c/a\u003e.","1_2":"Je krijgt alleen een notificatie als iemand je @naam noemt of reageert op je bericht.","1":"Je krijgt alleen een notificatie als iemand je @naam noemt of reageert op je bericht.","0_7":"Je negeert alle notificaties in deze categorie.","0_2":"Je negeert alle notificaties in deze topic.","0":"Je negeert alle notificaties in deze topic."},"watching_pm":{"title":"In de gaten houden","description":"Je krijgt een notificatie voor elk nieuw bericht in dit privéconversatie. Het aantal ongelezen en nieuwe berichten zal naast de topiclijst verschijnen."},"watching":{"title":"In de gaten houden","description":"Je krijgt een notificatie voor elk nieuw bericht in dit topic. Het aantal ongelezen en nieuwe berichten zal naast de topiclijst verschijnen."},"tracking_pm":{"title":"Volgen","description":"Het aantal ongelezen en nieuwe berichten verschijnt naast het privébericht. Je krijgt alleen een notificatie als iemand je @naam noemt of reageert op je bericht."},"tracking":{"title":"Volgen","description":"Het aantal ongelezen en nieuwe berichten wordt getoond naast de discussie in het overzicht. Je krijgt alleen een notificatie als iemand je @naam noemt of een bericht van jou beantwoord."},"regular":{"title":"Normaal","description":"Je zal alleen een notificatie krijgen als iemand je @naam vermeldt of een reactie geeft op je berichten."},"regular_pm":{"title":"Vaste Bezoeker","description":"Je krijgt alleen een notificatie als iemand je @naam noemt of je bericht in het prive-bericht beantwoord."},"muted_pm":{"title":"Negeren","description":"Je zal geen notificaties krijgen voor dit privébericht."},"muted":{"title":"Negeren","description":"Je zal geen notificaties krijgen voor deze topic en het zal ook niet verschijnen in je 'ongelezen'-tab."}},"actions":{"recover":"Herstel topic","delete":"Verwijder topic","open":"Open topic","close":"Sluit topic","auto_close":"Automatisch sluiten","make_banner":"Verwijder topic","remove_banner":"Verwijder bannertopic","unpin":"Ontpin topic","pin":"Pin topic","pin_globally":"Pin topic globaal vast","unarchive":"De-archiveer topic","archive":"Archiveer topic","invisible":"Maak onzichtbaar","visible":"Maak zichtbaar","reset_read":"Reset leesdata","multi_select":"Selecteer berichten"},"reply":{"title":"Reageer","help":"Schrijf een reactie op deze topic"},"clear_pin":{"title":"Verwijder pin","help":"Annuleer de gepinde status van deze topic, zodat het niet langer bovenaan je topiclijst verschijnt."},"share":{"title":"Deel","help":"deel een link naar deze topic"},"flag_topic":{"title":"Markeer","help":"Markeer dit bericht (privé) of zend een privébericht aan de schrijver","success_message":"Je hebt dit topic gemarkeerd"},"inviting":"Uitnodigen...","automatically_add_to_groups_optional":"Deze uitnodiging geeft ook toegang tot de volgende groepen: (optioneel, alleen voor beheerders)","automatically_add_to_groups_required":"Deze uitnodiging geeft ook toegang tot de volgende groepen: (\u003cb\u003eVerplicht\u003c/b\u003e, alleen voor beheerders)","invite_private":{"title":"Stuur een privébericht","email_or_username":"E-mail of gebruikersnaam van genodigde","email_or_username_placeholder":"e-mailadres of gebruikersnaam","action":"Uitnodigen","success":"Deze gebruiker is uitgenodigd om in de privé-conversatie deel te nemen","error":"Sorry, er is iets misgegaan bij het uitnodigen van deze persoon","group_name":"groepsnaam"},"invite_reply":{"title":"Anderen uitnodigen","action":"Mail uitnodiging","help":"verstuur uitnodigingen naar vrienden zodat zij met één klik kunnen reageren op deze topic","to_topic":"We zullen je vriend een korte e-mail sturen waardoor hij of zij meteen kan aanmelden en op dit topic kan reageren door op een link te klikken, hij of zij hoeft niet in te loggen.","to_forum":"We sturen een kort mailtje waarmee je vriend direct zich kan aanmelden door op een link te klikken, zonder te hoeven inloggen.","email_placeholder":"naam@voorbeeld.nl","success":"We hebben een uitnodiging verstuurd naar \u003cb\u003e{{email}}\u003c/b\u003e. We laten het je weten als de uitnodiging wordt gebruikt. Bekijk de uitnodigingen tab op je profielpagina om je uitnodigingen te volgen.","error":"Sorry, we kunnen deze persoon niet uitnodigen. Wellicht is deze al een lid op onze site?"},"login_reply":"Log in om te beantwoorden","filters":{"n_posts":{"one":"één bericht","other":"{{count}} berichten"},"cancel":"Laat alle berichten in deze topic weer zien."},"split_topic":{"title":"Verplaats naar nieuwe topic","action":"verplaats naar nieuwe topic","topic_name":"Naam nieuwe topic","error":"Er ging iets mis bij het verplaatsen van berichten naar de nieuwe topic.","instructions":{"one":"Je staat op het punt een nieuwe topic aan te maken en het te vullen met het bericht dat je geselecteerd hebt.","other":"Je staat op het punt een nieuwe topic aan te maken en het te vullen met de \u003cb\u003e{{count}}\u003c/b\u003e berichten die je geselecteerd hebt."}},"merge_topic":{"title":"Verplaats naar bestaande topic","action":"verplaats naar bestaande topic","error":"Er ging iets mis bij het verplaatsen van berichten naar die topic.","instructions":{"one":"Selecteer de topic waarnaar je het bericht wil verplaatsen.","other":"Selecteer de topic waarnaar je de \u003cb\u003e{{count}}\u003c/b\u003e berichten wil verplaatsen."}},"change_owner":{"title":"Wijzig eigenaar van berichten","action":"verander van eigenaar","error":"Er ging iets mis bij het veranderen van eigendom van dat bericht.","label":"Nieuwe eigenaar van berichten","placeholder":"gebruikersnaam van de nieuwe eigenaar","instructions":{"one":"Kies de nieuwe eigenaar van het bericht door \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Kies de nieuwe eigenaar van de {{count}} berichten door \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"Let op dat alle meldingen over deze discussie niet met terugwerkende kracht worden overgedragen aan de nieuwe gebruiker. \u003cbr\u003eWaarschuwing: Momenteel wordt geen bericht-afhankelijke gegevens overgedragen aan de nieuwe gebruiker. Wees voorzichtig met het gebruik hier van."},"multi_select":{"select":"selecteer","selected":"geselecteerd ({{count}})","select_replies":"selecteer +antwoorden","delete":"verwijder geselecteerde berichten","cancel":"annuleer selectie","select_all":"selecteer alles","deselect_all":"deselecteer alles","description":{"one":"Je hebt \u003cb\u003eéén\u003c/b\u003e bericht geselecteerd.","other":"Je hebt \u003cb\u003e{{count}}\u003c/b\u003e berichten geselecteerd."}}},"post":{"reply":"Reageren op {{link}} door {{replyAvatar}} {{username}}","reply_topic":"Reageer op {{link}}","quote_reply":"citeer","edit":"Bewerken van {{link}} door {{replyAvatar}} {{username}}","edit_reason":"Reden: ","post_number":"bericht {{number}}","in_reply_to":"reageer op","last_edited_on":"bericht gewijzig op","reply_as_new_topic":"Reageer in een nieuwe topic","continue_discussion":"Voortzetting van de discussie {{postLink}}:","follow_quote":"ga naar het geciteerde bericht","show_full":"Bekijk hele bericht","show_hidden":"Bekijk verborgen inhoud","deleted_by_author":{"one":"(bericht ingetrokken door de schrijver), wordt automatisch verwijderd over %{count} uur, tenzij gemarkeerd.","other":"(berichten ingetrokken door de schrijver), worden automatisch verwijderd over %{count} uur, tenzij gemarkeerd."},"expand_collapse":"in-/uitvouwen","gap":{"one":"Eén bericht weggelaten.","other":"{{count}} Berichten weggelaten."},"more_links":"{{count}} meer...","unread":"Bericht is ongelezen","has_replies":{"one":"Reactie","other":"Reacties"},"errors":{"create":"Sorry, er is iets misgegaan bij het plaatsen van je bericht. Probeer het nog eens.","edit":"Sorry, er is iets misgegaan bij het bewerken van je bericht. Probeer het nog eens.","upload":"Sorry, er is iets misgegaan bij het uploaden van je bestand. Probeer het nog eens.","attachment_too_large":"Sorry, het bestand dat je wil uploaden is te groot (maximum grootte is {{max_size_kb}}kb).","image_too_large":"Sorry, de afbeelding je wil uploaden is te groot (maximum grootte is {{max_size_kb}}kb), verklein de afbeelding en probeer het opnieuw.","too_many_uploads":"Sorry, je kan maar één afbeelding tegelijk uploaden.","upload_not_authorized":"Sorry, je mag dat type bestand niet uploaden (toegestane extensies: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Sorry, nieuwe gebruikers mogen nog geen afbeeldingen uploaden.","attachment_upload_not_allowed_for_new_user":"Sorry, nieuwe gebruikers mogen nog geen bestanden uploaden."},"abandon":{"confirm":"Weet je zeker dat je dit bericht wil afbreken?","no_value":"Nee, behouden","yes_value":"Ja, verwijderen"},"wiki":{"about":"deze discussie is een wiki; normale gebruikers kunnen hem aanpassen"},"archetypes":{"save":"Bewaar instellingen"},"controls":{"reply":"reageer op dit bericht","like":"vind dit bericht leuk","has_liked":"Je vind dit bericht leuk","undo_like":"like ongedaan maken","edit":"bewerk dit bericht","edit_anonymous":"Sorry, maar je moet ingelogd zijn om dit bericht aan te kunnen passen.","flag":"meld dit bericht of stuur er een notificatie over (alleen zichtbaar voor moderatoren en admins)","delete":"verwijder dit bericht","undelete":"herstel dit bericht","share":"deel een link naar dit bericht","more":"Meer","delete_replies":{"confirm":{"one":"Wil je ook het directe antwoord op dit bericht verwijderen?","other":"Wil je ook de {{count}} directe antwoorden op dit bericht verwijderen?"},"yes_value":"Ja, verwijder deze antwoorden ook","no_value":"Nee, alleen dit bericht"},"admin":"adminacties voor bericht","wiki":"Maak wiki van bericht","unwiki":"Bericht niet meer als wiki gebruiken"},"actions":{"flag":"Markeer","it_too":{"off_topic":"Markeer het ook","spam":"Markeer het ook","inappropriate":"Markeer deze ook","custom_flag":"Markeer het ook","bookmark":"Zet het ook in je bladwijzers","like":"Vind het ook leuk","vote":"Stem ook"},"undo":{"off_topic":"Verwijder markering","spam":"Verwijder markering","inappropriate":"Hef markering op","bookmark":"Verwijder uit je bladwijzers","like":"Vind het niet meer leuk","vote":"Stem niet meer"},"people":{"off_topic":"{{icons}} markeerden dit als off-topic","spam":"{{icons}} markeerden dit als spam","inappropriate":"{{icons}} markeerden dit als ongepast","notify_moderators":"{{icons}} lichtte moderators in","notify_moderators_with_url":"{{icons}} \u003ca href='{{postUrl}}'\u003elichtte moderators in\u003c/a\u003e","notify_user":"{{icons}} verstuurde een privé-bericht","notify_user_with_url":"{{icons}} verstuurde een \u003ca href='{{postUrl}}'\u003eprivé-bericht\u003c/a\u003e","bookmark":"{{icons}} voegden dit toe aan hun bladwijzers","like":"{{icons}} vinden dit leuk","vote":"{{icons}} hebben hier op gestemd"},"by_you":{"off_topic":"Jij markeerde dit als off-topic","spam":"Jij markeerde dit als spam","inappropriate":"Jij markeerde dit als ongepast","notify_moderators":"Jij markeerde dit voor moderatie","notify_user":"Jij stuurde een privé-bericht naar deze persoon","bookmark":"Jij voegde dit bericht toe aan je bladwijzers","like":"Jij vindt dit leuk","vote":"Jij hebt op dit bericht gestemd"},"by_you_and_others":{"off_topic":{"one":"Jij en iemand anders markeerden dit als off-topic","other":"Jij en {{count}} anderen markeerden dit als off-topic"},"spam":{"one":"Jij en iemand anders markeerden dit als spam","other":"Jij en {{count}} anderen markeerden dit als spam"},"inappropriate":{"one":"Jij en iemand anders markeerden dit als ongepast","other":"Jij en {{count}} anderen markeerden dit als ongepast"},"notify_moderators":{"one":"Jij en iemand anders markeerden dit voor moderatie","other":"Jij en {{count}} anderen markeerden dit voor moderatie"},"notify_user":{"one":"Jij en iemand anders stuurden een privé-bericht naar deze persoon","other":"Jij en {{count}} anderen stuurden een privé-bericht naar deze persoon"},"bookmark":{"one":"Jij en iemand anders voegden dit bericht toe aan de favorieten","other":"Jij en {{count}} anderen voegden dit bericht toe aan hun bladwijzers"},"like":{"one":"Jij en iemand anders vinden dit leuk","other":"Jij en {{count}} anderen vinden dit leuk"},"vote":{"one":"Jij en iemand anders hebben op dit bericht gestemd","other":"Jij en {{count}} anderen hebben op dit bericht gestemd"}},"by_others":{"off_topic":{"one":"Iemand heeft dit bericht gemarkeerd als off-topic","other":"{{count}} Mensen hebben dit bericht gemarkeerd als off-topic"},"spam":{"one":"Iemand heeft dit bericht gemarkeerd als spam","other":"{{count}} Mensen hebben dit bericht gemarkeerd als spam"},"inappropriate":{"one":"Iemand heeft dit bericht gemarkeerd als ongepast ","other":"{{count}} Mensen hebben dit bericht gemarkeerd als ongepast"},"notify_moderators":{"one":"Iemand heeft dit bericht gemarkeerd voor moderatie","other":"{{count}} Mensen hebben dit bericht gemarkeerd voor moderatie"},"notify_user":{"one":"Iemand stuurde een privé-bericht naar deze persoon","other":"{{count}} Mensen stuurden een privé-bericht naar deze persoon"},"bookmark":{"one":"Iemand heeft dit bericht toegevoegd aan zijn favorieten","other":"{{count}} mensen hebben dit bericht toegevoegd aan hun bladwijzers"},"like":{"one":"iemand vindt dit leuk","other":"{{count}} mensen vinden dit leuk"},"vote":{"one":"Iemand heeft op dit bericht gestemd","other":"{{count}} Mensen hebben op dit bericht gestemd"}}},"edits":{"one":"één bewerking","other":"{{count}} bewerkingen","zero":"geen bewerkingen"},"delete":{"confirm":{"one":"Weet je zeker dat je dit bericht wil verwijderen?","other":"Weet je zeker dat je al deze berichten wil verwijderen?"}},"revisions":{"controls":{"first":"Eerste revisie","previous":"Vorige revisie","next":"Volgende revisie","last":"Laatste revisie","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e vs \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Toon de het gerenderde bericht met wijzigingen als één geheel","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Toon de wijzigingen in het gerenderde bericht naast elkaar","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Toon de wijzigingen in het gerenderde bericht als markdown naast elkaar","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Markdown"}},"details":{"edited_by":"Gewijzigd door"}}},"category":{"can":"kan...","none":"(geen categorie)","choose":"Selecteer een categorie\u0026hellip;","edit":"bewerk","edit_long":"Wijzig","view":"Bekijk topics in categorie","general":"Algemeen","settings":"Instellingen","delete":"Verwijder categorie","create":"Maak categorie","save":"Bewaar categorie","creation_error":"Er ging bij het maken van de categorie iets mis.","save_error":"Er ging iets mis bij het opslaan van de categorie.","name":"Naam categorie","description":"Omschrijving","topic":"Onderwerp van de categorie","logo":"Category logo afbeelding","background_image":"Categorie achtergrondafbeelding","badge_colors":"Badgekleuren","background_color":"Achtergrondkleur","foreground_color":"Voorgrondkleur","name_placeholder":"Maximaal een of twee woorden","color_placeholder":"Kan elke webkleur zijn","delete_confirm":"Weet je zeker dat je deze categorie wil verwijderen?","delete_error":"Er ging iets mis bij het verwijderen van deze categorie","list":"Lijst van categorieën","no_description":"Voeg een beschrijving toe voor deze categorie","change_in_category_topic":"Wijzig omschrijving","already_used":"Deze kleur is al in gebruik door een andere categorie","security":"Beveiliging","images":"Afbeeldingen","auto_close_label":"Sluit topics automatisch na:","auto_close_units":"uren","email_in":"Adres voor inkomende mail:","email_in_allow_strangers":"Accepteer mails van anonieme gebruikers zonder account","email_in_disabled":"Het plaatsen van nieuwe discussies via e-mail is uitgeschakeld in de Site Instellingen. Om het plaatsen van nieuwe discussie via e-mail aan te zetten,","email_in_disabled_click":"schakel \"e-mail in\" instelling in.","allow_badges_label":"Laat badges toekennen voor deze categorie","edit_permissions":"Wijzig permissies","add_permission":"Nieuwe permissie","this_year":"dit jaar","position":"positie","default_position":"Standaard positie","position_disabled":"Categorieën worden getoond op volgorde van activiteit. Om de volgorde van categorieën in lijst aan te passen,","position_disabled_click":"schakel \"vaste categorie posities\" in.","parent":"Bovenliggende categorie","notifications":{"watching":{"title":"In de gaten houden"},"tracking":{"title":"Volgen"},"regular":{"title":"Regulier"},"muted":{"title":"Genegeerd"}}},"flagging":{"title":"Waarom meld je dit bericht (alleen zichtbaar voor moderatoren en admins)?","action":"Meld bericht","take_action":"Onderneem actie","notify_action":"Meld","delete_spammer":"Verwijder spammer","delete_confirm":"Je gaat nu \u003cb\u003e%{posts}\u003c/b\u003e berichten en \u003cb\u003e%{topics}\u003c/b\u003e van deze gebruiker verwijderen, hun account verwijderen, nieuwe aanmeldingen vanaf hun IP-adres \u003cb\u003e%{ip_address}\u003c/b\u003e blokkeren en hun e-mailadres \u003cb\u003e%{email}\u003c/b\u003e op een permanente blokkeerlijst zetten. Weet je zeker dat dit een spammer is?","yes_delete_spammer":"Ja, verwijder spammer","submit_tooltip":"Verstuur de privé markering","cant":"Sorry, je kan dit bericht momenteel niet melden.","custom_placeholder_notify_user":"Wat maakt dat je de schrijver persoonlijk iets wil melden? Wees specifiek, constructief en altijd aardig.","custom_placeholder_notify_moderators":"Waarom heeft dit bericht aandacht van een moderator nodig? Laat ons specifiek weten waar je je zorgen om maakt en stuur relevante links mee waar mogelijk.","custom_message":{"at_least":"Gebruik ten minste {{n}} tekens","more":"Nog {{n}} te gaan...","left":"Nog {{n}}"}},"flagging_topic":{"title":"Waarom markeer je deze topic (privé)?","action":"Markeer topic","notify_action":"Notificeer"},"topic_map":{"title":"Topicsamenvatting","links_shown":"laat alle {{totalLinks}} links zien...","clicks":{"one":"1 click","other":"%{count} clicks"}},"topic_statuses":{"locked":{"help":"Deze topic is gesloten; reageren is niet meer mogelijk"},"unpinned":{"title":"Niet vastgepind","help":"Deze topic is niet langer vastgepind en zal weer normaal in de lijst getoond worden"},"pinned_globally":{"title":"Globaal vastgepind","help":"Deze topic is globaal vastgepind en zal bovenaan alle topiclijsten getoond worden"},"pinned":{"title":"Vastgepind","help":"Deze topic is vastgepind en zal bovenaan de categorie getoond worden"},"archived":{"help":"Deze topic is gearchiveerd en kan niet meer gewijzigd worden"},"invisible":{"help":"Deze topic is niet zichtbaar, zal niet verschijnen in de topiclijst en kan alleen bekeken worden met een directe link"}},"posts":"Berichten","posts_lowercase":"berichten","posts_long":"er zijn {{number}} berichten in deze topic","original_post":"Originele bericht","views":"Bekeken","replies":"Reacties","views_long":"deze topic is {{number}} keer bekeken","activity":"Activiteit","likes":"Leuk","likes_long":"er zijn {{count}} likes in deze topic","users":"Gebruikers","category_title":"Categorie","history":"Geschiedenis","changed_by":"door {{author}}","categories_list":"Categorielijst","filters":{"latest":{"title":"Recent","help":"topics met recente reacties"},"hot":{"title":"Populair","help":"een selectie van de meest populaire topics"},"starred":{"title":"Met ster","help":"topics die je met een ster hebt gemarkeerd"},"read":{"title":"Gelezen","help":"topics die je hebt gelezen, in de volgorde wanneer je ze voor het laatst gelezen hebt"},"categories":{"title":"Categorieën","title_in":"Categorie - {{categoryName}}","help":"alle topics gesorteerd op categorie"},"unread":{"title":{"zero":"Ongelezen","one":"Ongelezen (1)","other":"Ongelezen ({{count}})"}},"new":{"lower_title_with_count":{"one":"1 nieuwe","other":"{{count}} nieuwe"},"lower_title":"nieuw","title":{"zero":"Nieuw","one":"Nieuw (1)","other":"Nieuw ({{count}})"}},"posted":{"title":"Mijn berichten","help":"topics waarin je een bericht hebt geplaatst"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"recente topics in de categorie {{categoryName}}"},"top":{"title":"Top","yearly":{"title":"Jaarlijkse top"},"monthly":{"title":"Maandlijkse top"},"weekly":{"title":"Wekelijkse top"},"daily":{"title":"Dagelijkse top"},"this_year":"Dit jaar","this_month":"Deze maand","this_week":"Deze week","today":"Vandaag","other_periods":"bekijk meer top-topics"}},"permission_types":{"full":"Maak topic / Reageer / Bekijk","create_post":"Reageer / Bekijk","readonly":"Bekijk"},"type_to_filter":"typ om te filteren...","admin":{"title":"Discourse Beheer","moderator":"Moderator","dashboard":{"title":"Dashboard","last_updated":"Dashboard laatst bijgewerkt:","version":"Versie","up_to_date":"Je bent up to date!","critical_available":"Er is een belangrijke update beschikbaar","updates_available":"Er zijn updates beschikbaar","please_upgrade":"Werk de software bij alsjeblieft","no_check_performed":"Er is nog niet op updates gecontroleerd. Zorgen dat sidekiq loopt.\"","stale_data":"Er is al een tijdje niet op updates gecontroleerd. Zorg dat sidekiq loopt.\"","version_check_pending":"Je hebt de software recentelijk bijgewerkt. Mooi!","installed_version":"Geïnstalleerd","latest_version":"Recent","problems_found":"Er zijn een aantal problemen gevonden met je Discourse-installatie:","last_checked":"Laatste check","refresh_problems":"Laad opnieuw","no_problems":"Er zijn geen problemen gevonden","moderators":"Moderators:","admins":"Admins:","blocked":"Geblokkeerd:","suspended":"Geschorst:","private_messages_short":"PBs","private_messages_title":"Privéberichten","reports":{"today":"Vandaag","yesterday":"Gisteren","last_7_days":"Afgelopen 7 dagen","last_30_days":"Afgelopen 30 dagen","all_time":"Sinds het begin","7_days_ago":"7 Dagen geleden","30_days_ago":"30 Dagen geleden","all":"Alle","view_table":"Bekijk als tabel","view_chart":"Bekijk als staafdiagram"}},"commits":{"latest_changes":"Laatste wijzigingen: update regelmatig!","by":"door"},"flags":{"title":"Meldingen","old":"Oud","active":"Actief","agree":"Akkoord","agree_title":"Bevestig dat deze melding geldig en correct is","agree_flag_modal_title":"Akkoord en ... ","agree_flag_hide_post":"Akkoord (verberg bericht en stuur privébericht)","agree_flag_hide_post_title":"Verberg dit bericht en stuur de gebruiker automatisch een privébericht met het verzoek om het bericht aan te passen. ","agree_flag":"Akkoord met melding","agree_flag_title":"Akkoord met melding en het bericht ongewijzigd laten","defer_flag":"Negeer","defer_flag_title":"Verwijder deze melding; nu geen actie nodig","delete":"Verwijder","delete_title":"Verwijder het bericht waar deze melding naar verwijst","delete_post_defer_flag":"Verwijder bericht en negeer melding","delete_post_defer_flag_title":"Verwijder bericht; de hele topic als dit het eerste bericht is","delete_post_agree_flag":"Verwijder bericht en akkoord met melding","delete_post_agree_flag_title":"Verwijder bericht; de hele topic als dit het eerste bericht is","delete_flag_modal_title":"Verwijder en ... ","delete_spammer":"Verwijder spammer","delete_spammer_title":"Verwijder de gebruiker en al hun berichten en topics.","disagree_flag_unhide_post":"Niet akkoord (toon bericht)","disagree_flag_unhide_post_title":"Verwijder elke melding van dit bericht en maak het weer zichtbaar","disagree_flag":"Niet akkoord","disagree_flag_title":"Deze melding is ongeldig of niet correct","clear_topic_flags":"Gedaan","clear_topic_flags_title":"Het topic is onderzocht en problemen zijn opgelost. Klik op Gedaan om de meldingen te verwijderen.","more":"(meer antwoorden...)","dispositions":{"agreed":"akkoord","disagreed":"niet akkoord","deferred":"genegeerd"},"flagged_by":"Gemarkeerd door","resolved_by":"Opgelost door","took_action":"Heeft actie ondernomen","system":"Systeem","error":"Er ging iets mis","reply_message":"Reageer","no_results":"Er zijn geen markeringen","topic_flagged":"Deze \u003cstrong\u003etopic\u003c/strong\u003e is gemarkeerd.","visit_topic":"Ga naar de topic om te zien wat er aan de hand is en om actie te ondernemen","was_edited":"Bericht is gewijzigd na de eerste melding","summary":{"action_type_3":{"one":"off-topic","other":"off-topic x{{count}}"},"action_type_4":{"one":"ongepast","other":"ongepast x{{count}}"},"action_type_6":{"one":"custom","other":"custom x{{count}}"},"action_type_7":{"one":"custom","other":"custom x{{count}}"},"action_type_8":{"one":"spam","other":"spam x{{count}}"}}},"groups":{"primary":"Primaire groep","no_primary":"(geen primaire groep)","title":"Groepen","edit":"Wijzig groepen","refresh":"Herlaad","new":"Nieuw","selector_placeholder":"voeg leden toe","name_placeholder":"Groepsnaam, geen spaties, zelfde regels als bij een gebruikersnaam","about":"Wijzig hier je deelname aan groepen en je namen","group_members":"Groepsleden","delete":"Verwijder","delete_confirm":"Verwijder deze groepen?","delete_failed":"Kan groep niet verwijderen. Als dit een automatische groep is, kan deze niet verwijderd worden."},"api":{"generate_master":"Genereer Master API Key","none":"Er zijn geen actieve API keys","user":"Gebruiker","title":"API","key":"API Key","generate":"Genereer","regenerate":"Genereer opnieuw","revoke":"Intrekken","confirm_regen":"Weet je zeker dat je die API Key wil vervangen door een nieuwe?","confirm_revoke":"Weet je zeker dat je die API Key wil intrekken?","info_html":"Met deze API key kun je met behulp van JSON calls topics maken en bewerken.","all_users":"Alle gebruikers"},"backups":{"title":"Backups","menu":{"backups":"Backups","logs":"Logs"},"none":"Geen backup beschikbaar.","read_only":{"enable":{"title":"Zet forum in read-only modus","text":"Schakel read-only modus in","confirm":"Weet je zeker dat je het forum in read-only modus wil zetten?"},"disable":{"title":"Schakel read-only modus uit","text":"Schakel read-only modus uit"}},"logs":{"none":"Nog geen logs..."},"columns":{"filename":"Bestandsnaam","size":"Grootte"},"upload":{"text":"UPLOAD","uploading":"UPLOADEN","success":"'{{filename}}' is geupload.","error":"Er ging iets fout bij het uploaden van '{{filename}}': {{message}}"},"operations":{"is_running":"Er wordt al een actie uitgevoerd...","failed":"De actie {{operation}} is mislukt. Kijk in de logs.","cancel":{"text":"Annuleer","title":"Annuleer de huidige actie","confirm":"Weet je zeker dat je de huidige actie wil annuleren?"},"backup":{"text":"Backup","title":"Maak een backup","confirm":"Wil je een nieuwe backup starten? ","without_uploads":"Ja (zonder upload)"},"download":{"text":"Download","title":"Download de backup"},"destroy":{"text":"Verwijder","title":"Verwijder de backup","confirm":"Weet je zeker dat je deze backup wil verwijderen?"},"restore":{"is_disabled":"Herstellen is uitgeschakeld in de instellingen.","text":"Herstel","title":"Herstel van deze backup","confirm":"Weet je zeker dat je van deze backup wil herstellen?"},"rollback":{"text":"Rollback","title":"Herstel de database naar de laatst werkende versie","confirm":"Weet je zeker dat je de database wil herstellen naar de laatste versie?"}}},"export_csv":{"users":{"text":"Exporteer gebruikers","title":"Exporteer gebruikerslijst in *.CSV-formaat"},"success":"Exporteren is gestart; over enkele momenten krijg je meer informatie over de voortgang","failed":"Exporteren is mislukt. Controleer de logbestanden."},"customize":{"title":"Aanpassingen","long_title":"Aanpassingen aan de site","header":"Header","css":"Stylesheet","mobile_header":"Mobiele header","mobile_css":"Mobiele stylesheet","override_default":"Sluit de standaard stylesheet uit","enabled":"Ingeschakeld?","preview":"voorbeeld","undo_preview":"verwijder voorbeeld","rescue_preview":"standaard stijl","explain_preview":"Bekijk de site met deze aangepaste stylesheet","explain_undo_preview":"Herstel huidige geactiveerde aangepaste stylesheet","explain_rescue_preview":"Bekijk de site met de standaard stylesheet","save":"Opslaan","new":"Nieuw","new_style":"Nieuwe stijl","delete":"Verwijder","delete_confirm":"Verwijder deze aanpassing?","about":"Pas CSS stylesheets en HTML headers aan op de site. Voeg een aanpassing toe om te beginnen.","color":"Kleur","opacity":"Doorzichtigheid","copy":"Kopieër","css_html":{"title":"CSS/HTML","long_title":"CSS en HTML aanpassingen"},"colors":{"title":"Kleuren","long_title":"Kleurenschema's","about":"Met kleurenschema's kun je de kleuren in de site aanpassen zonder CSS te hoeven gebruiken. Kies er één of voeg er één to om te beginnen.","new_name":"Nieuw kleurenschema","copy_name_prefix":"Kopie van","delete_confirm":"Dit kleurenschema verwijderen?","undo":"herstel","undo_title":"Draai je wijzigingen aan deze kleur terug tot de laatste keer dat het opgeslagen is.","revert":"Zet terug","revert_title":"Zet deze kleur terug naar het standaard kleurenschema van Discourse.","primary":{"name":"primaire","description":"Meeste teksten, iconen en randen."},"secondary":{"name":"secundaire","description":"De achtergrondkleur, tekst en knoppen."},"tertiary":{"name":"tertiaire","description":"Links, knoppen, notificaties en accentkleur."},"quaternary":{"name":"quaternaire","description":"Navigatie."},"header_background":{"name":"headerachtergrond","description":"Achtergrondkleur van de header."},"header_primary":{"name":"eerste header","description":"Tekst en iconen in de header."},"highlight":{"name":"opvallen","description":"De achtergrondkleur van "},"danger":{"name":"gevaar","description":"Opvallende kleuren voor acties als verwijderen van berichten en topics"},"success":{"name":"succes","description":"Gebruikt om aan te geven dat een actie gelukt is."},"love":{"name":"liefde","description":"De like knop kleur."}}},"email":{"title":"E-mail","settings":"Instellingen","all":"Alle","sending_test":"Testmail wordt verstuurd...","test_error":"Er ging iets mis bij het versturen van de testmail. Kijk nog eens naar je mailinstellinen, controleer of je host mailconnecties niet blokkeert. Probeer daarna opnieuw.","sent":"Verzonden","skipped":"Overgeslagen","sent_at":"Verzonden op","time":"Tijd","user":"Gebruiker","email_type":"E-mailtype","to_address":"Ontvangeradres","test_email_address":"e-mailadres om te testen","send_test":"verstuur test e-mail","sent_test":"verzonden!","delivery_method":"Verzendmethode","preview_digest":"Voorbeeld digestmail","preview_digest_desc":"Hiermee kun je een voorbeeld van de digest email zien die vanaf het forum wordt verstuurd.","refresh":"Verniew","format":"Formaat","html":"html","text":"text","last_seen_user":"Laatste online:","reply_key":"Reply key","skipped_reason":"Reden van overslaan","logs":{"none":"Geen logs gevonden.","filters":{"title":"Filter","user_placeholder":"gebruikersnaam","address_placeholder":"naam@voorbeeld.nl","type_placeholder":"digest, inschijving","skipped_reason_placeholder":"reden"}}},"logs":{"title":"Logs","action":"Actie","created_at":"Gemaakt","last_match_at":"Laatste match","match_count":"Matches","ip_address":"IP","delete":"Verwijder","edit":"Wijzig","save":"Opslaan","screened_actions":{"block":"blokkeer","do_nothing":"doe niets"},"staff_actions":{"title":"Stafacties","instructions":"Klik op gebruikersnamen en acties om te filteren. Klik op avatars om naar de gebruikerspagina te gaan.","clear_filters":"Bekijk alles","staff_user":"Staflid","target_user":"Selecteer gebruiker","subject":"Onderwerp","when":"Wanneer","context":"Context","details":"Details","previous_value":"Vorige","new_value":"Nieuw","diff":"Verschil","show":"Bekijk","modal_title":"Details","no_previous":"Er is geen vorige waarde","deleted":"Geen nieuwe waarde. De record was verwijderd.","actions":{"delete_user":"verwijder gebruiker","change_trust_level":"verander trustlevel","change_site_setting":"verander instellingen","change_site_customization":"verander site aanpassingen","delete_site_customization":"verwijder site aanpassingen","suspend_user":"schors gebruiker","unsuspend_user":"hef schorsing op","grant_badge":"ken badge toe","revoke_badge":"trek badge in"}},"screened_emails":{"title":"Gescreende e-mails","description":"Nieuwe accounts met een van deze mailadressen worden geblokkeerd of een andere actie wordt ondernomen.","email":"E-mailadres","actions":{"allow":"Sta toe"}},"screened_urls":{"title":"Gescreende urls","description":"Deze urls zijn gebruikt door gebruikers die als spammer gemarkeerd zijn.","url":"URL","domain":"Domein"},"screened_ips":{"title":"Gescreende ip-adressen","description":"IP-adressen die in de gaten worden gehouden. Kies 'sta toe' om deze op een witte lijst te zetten.","delete_confirm":"Weet je zeker dat je de regel voor %{ip_address} wil verwijderen?","actions":{"block":"Blokkeer","do_nothing":"Sta toe"},"form":{"label":"Nieuw:","ip_address":"IP-adres","add":"Voeg toe"}}},"users":{"title":"Leden","create":"Voeg beheerder toe","last_emailed":"Laatste mail verstuurd","not_found":"Sorry, deze gebruikersnaam bestaat niet in ons systeem.","active":"Actief","nav":{"new":"Nieuw","active":"Actief","pending":"Te beoordelen","admins":"Admins","moderators":"Moderatoren","suspended":"Geschorst","blocked":"Geblokt"},"approved":"Goedgekeurd?","approved_selected":{"one":"accepteer lid","other":"accepteer {{count}} leden"},"reject_selected":{"one":"weiger lid","other":"weiger {{count}} leden"},"titles":{"active":"Actieve leden","new":"Nieuwe leden","pending":"Nog niet geaccepteerde leden","newuser":"Leden met Trust Level 0 (Nieuw lid)","basic":"Leden met Trust Level 1 (Lid)","regular":"Leden met Trust Level 2 (Regulier lid)","elder":"Leden met Trust Level 4 (Ervaren lid)","admins":"Administrators","moderators":"Moderators","blocked":"Geblokkeerde leden","suspended":"Geschorste leden"},"reject_successful":{"one":"1 Gebruiker met succes geweigerd","other":"%{count} Gebruikers met succes geweigerd"},"reject_failures":{"one":"Weigering van 1 gebruiker is niet gelukt","other":"Weigering van %{count} gebruikers is niet gelukt"}},"user":{"suspend_failed":"Er ging iets fout met het blokkeren van deze gebruiker: {{error}}","unsuspend_failed":"Er ging iets fout bij het deblokkeren van deze gebruiker: {{error}}","suspend_duration":"Hoe lang wil je deze gebruiker blokkeren?","suspend_duration_units":"(dagen)","suspend_reason_label":"Waarom schors je deze gebruiker? \u003cb\u003eIedereen zal deze tekst kunnen zien\u003c/b\u003e op de profielpagina van deze gebruiker en zal getoond worden als deze gebruiker probeert in te loggen. Houd het kort en bondig.","suspend_reason":"Reden","suspended_by":"Geschorst door","delete_all_posts":"Verwijder alle berichten","delete_all_posts_confirm":"Je gaat %{posts} en %{topics} verwijderen. Zeker weten?","suspend":"Schors","unsuspend":"Herstel schorsing","suspended":"Geschorst?","moderator":"Moderator?","admin":"Beheerder?","blocked":"Geblokkeerd?","show_admin_profile":"Beheerder","edit_title":"Wijzig titel","save_title":"Bewaar titel","refresh_browsers":"Forceer browser refresh","refresh_browsers_message":"Bericht verstuurd aan alle gebruikers!","show_public_profile":"Bekijk openbaar profiel","impersonate":"Log in als gebruiker","ip_lookup":"Zoek IP-adres op","log_out":"Uitloggen","logged_out":"Gebruiker is uitgelogd op alle apparaten","revoke_admin":"Ontneem beheerdersrechten","grant_admin":"Geef Beheerdersrechten","revoke_moderation":"Ontneem modereerrechten","grant_moderation":"Geef modereerrechten","unblock":"Deblokkeer","block":"Blokkeer","reputation":"Reputatie","permissions":"Toestemmingen","activity":"Activiteit","like_count":"'Vind ik leuks' gegeven / ontvangen","last_100_days":"in de laatste 100 dagen","private_topics_count":"Privétopics","posts_read_count":"Berichten gelezen","post_count":"Berichten gemaakt","topics_entered":"Topics bekeken","flags_given_count":"Meldingen gedaan","flags_received_count":"Meldigen ontvangen","flags_given_received_count":"Meldingen gedaan / ontvangen","approve":"Accepteer","approved_by":"Geaccepteerd door","approve_success":"Gebruiker geaccepteerd en e-mail verzonden met instructies voor activering.","approve_bulk_success":"Alle geselecteerde gebruikers zijn geaccepteerd en een e-mail met instructies voor activering is verstuurd.","time_read":"Leestijd","delete":"Verwijder gebruiker","delete_forbidden_because_staff":"Admins en moderatoren kunnen niet verwijderd worden.","delete_forbidden":{"one":"Gebruikers kunnen niet worden verwijderd als ze berichten geplaatst hebben. Verwijder alle berichten voordat je een gebruiker probeert te verwijderen. (Berichten ouder dan %{count} dag kunnen niet verwijderd worden)","other":"Gebruikers kunnen niet worden verwijderd als ze berichten geplaatst hebben. Verwijder alle berichten voordat je een gebruiker probeert te verwijderen. (Berichten ouder dan %{count} dagen kunnen niet verwijderd worden)"},"cant_delete_all_posts":{"one":"Kan niet alle berichten verwijderen. Sommige berichten zijn ouder dan %{count} dag (de delete_user_max_post_age instelling).","other":"Kan niet alle berichten verwijderen. Sommige berichten zijn ouder dan %{count} dagen (de delete_user_max_post_age instelling)."},"cant_delete_all_too_many_posts":{"one":"Kan niet alle berichten verwijderen omdat de gebruiker meer dan 1 bericht heeft (delete_all_posts_max).","other":"Kan niet alle berichten verwijderen omdat de gebruiker meer dan %{count} berichten heeft (delete_all_posts_max)."},"delete_confirm":"Weet je zeker dat je deze gebruiker definitief wil verwijderen? Deze handeling kan niet ongedaan worden gemaakt! ","delete_and_block":"Verwijder en \u003cb\u003eblokkeer\u003c/b\u003e dit e-mail- en IP-adres","delete_dont_block":"Alleen verwijderen","deleted":"De gebruiker is verwijderd.","delete_failed":"Er ging iets mis bij het verwijderen van deze gebruiker. Zorg er voor dat alle berichten van deze gebruiker eerst verwijderd zijn.","send_activation_email":"Verstuur activatiemail","activation_email_sent":"Een activatiemail is verstuurd.","send_activation_email_failed":"Er ging iets mis bij het versturen van de activatiemail.","activate":"Activeer account","activate_failed":"Er ging iets mis bij het activeren van deze gebruiker.","deactivate_account":"Deactiveer account","deactivate_failed":"Er ging iets mis bij het deactiveren van deze gebruiker.","unblock_failed":"Er ging iets mis bij het deblokkeren van deze gebruiker.","block_failed":"Er ging iets mis bij het blokkeren van deze gebruiker.","deactivate_explanation":"Een gedeactiveerde gebruiker moet zijn e-mailadres opnieuw bevestigen.","suspended_explanation":"Een geschorste gebruiker kan niet meer inloggen.","block_explanation":"Een geblokkeerde gebruiker kan geen topics maken of reageren op topics.","trust_level_change_failed":"Er ging iets mis bij het wijzigen van het trust level van deze gebruiker.","suspend_modal_title":"Schors gebruiker","trust_level_2_users":"Trust Level 2 leden","trust_level_3_requirements":"Trust Level 3 vereisten","tl3_requirements":{"title":"Vereisten voor Trust Level 3","table_title":"In de afgelopen 100 dagen:","value_heading":"Waarde","requirement_heading":"Vereiste","visits":"Bezoeken","days":"dagen","topics_replied_to":"Topics waarin gereageerd is","topics_viewed":"Bekeken topics","topics_viewed_all_time":"Topics bezocht (ooit)","posts_read":"Gelezen berichten","posts_read_all_time":"Berichten gelezen (ooit)","flagged_posts":"Gemarkeerde berichten","flagged_by_users":"Gebruikers die gemarkeerd hebben","likes_given":"'Vind ik leuks' gegeven","likes_received":"'Vind ik leuks' ontvangen","qualifies":"Komt in aanmerking voor Trust Level 3","will_be_promoted":"Zal over 24 uur gepromoveerd worden.","does_not_qualify":"Komt niet in aanmerking voor Trust Level 3"},"sso":{"external_username":"Gebruikersnaam","external_name":"Naam","external_email":"E-mail","external_avatar_url":"URL voor profielfoto"}},"site_content":{"none":"Selecteer een tekst om deze te bewerken","title":"Teksten","edit":"Bewerk teksten"},"site_settings":{"show_overriden":"Bekijk alleen bewerkte instellingen","title":"Instellingen","reset":"herstel","none":"geen","no_results":"Geen resultaten.","clear_filter":"Wis","categories":{"all_results":"Alle","required":"Vereist","basic":"Basissetup","users":"Gebruikers","posting":"Schrijven","email":"E-mail","files":"Bestanden","trust":"Trustlevels","security":"Beveiliging","onebox":"Onebox","seo":"SEO","spam":"Spam","rate_limits":"Rate limits","developer":"Ontwikkelaar","embedding":"Embedden","legal":"Juridisch","uncategorized":"Overige","backups":"Backups","login":"Gebruikersnaam"}},"badges":{"title":"Badges","new_badge":"Nieuwe badge","new":"Nieuw","name":"Naam","badge":"Embleem","display_name":"Lange naam","description":"Omschrijving","badge_type":"Badgetype","badge_grouping":"Groep","granted_by":"Toegekend door","granted_at":"Toegekend op","save":"Bewaar","delete":"Verwijder","delete_confirm":"Weet je zeker dat je deze badge wil verwijderen?","revoke":"Intrekken","revoke_confirm":"Weet je zeker dat je deze badge in wil trekken?","edit_badges":"Wijzig badges","grant_badge":"Ken badge toe","granted_badges":"Toegekende badges","grant":"Toekennen","no_user_badges":"%{name} heeft nog geen badges toegekend gekregen.","no_badges":"Er zijn geen badges die toegekend kunnen worden.","allow_title":"Embleem mag als titel gebruikt worden","multiple_grant":"Kan meerdere malen worden toegekend","listable":"Badge op de publieke badges pagina tonen","enabled":"Badge aanzetten","icon":"Icoon"}},"lightbox":{"download":"download"},"keyboard_shortcuts_help":{"jump_to":{"title":"Spring naar"},"navigation":{"title":"Navigatie","jump":"\u003cb\u003e#\u003c/b\u003e Ga naar post nummer","back":"\u003cb\u003eu\u003c/b\u003e Terug","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Verplaats selectie omhoog/omlaag","open":"\u003cb\u003eo\u003c/b\u003e of \u003cb\u003eEnter\u003c/b\u003e Open geselecteerde topic"},"application":{"title":"Applicatie","create":"\u003cb\u003ec\u003c/b\u003e Maak nieuwe topic","notifications":"\u003cb\u003en\u003c/b\u003e Open notificaties","search":"\u003cb\u003e/\u003c/b\u003e Zoek","help":"\u003cb\u003e?\u003c/b\u003e Open keyboard shortcuts help"},"actions":{"title":"Acties","star":"\u003cb\u003ef\u003c/b\u003e Markeer topic met ster","share_topic":"\u003cb\u003eshift s\u003c/b\u003e Deel topic","share_post":"\u003cb\u003es\u003c/b\u003e Deel bericht","reply_topic":"\u003cb\u003eshift r\u003c/b\u003e Reageer op topic","reply_post":"\u003cb\u003eshift r\u003c/b\u003e Reageer op topic","quote_post":"\u003cb\u003eq\u003c/b\u003e Citeer bericht","like":"\u003cb\u003el\u003c/b\u003e Vind bericht leuk","flag":"\u003cb\u003e!\u003c/b\u003e Markeer bericht","bookmark":"\u003cb\u003eb\u003c/b\u003e Bookmark bericht","edit":"\u003cb\u003ee\u003c/b\u003e Wijzig bericht","delete":"\u003cb\u003ed\u003c/b\u003e Verwijder bericht"}},"badges":{"title":"Badges","allow_title":"badge als titel toestaan","multiple_grant":"Meerdere malen toegekend?","badge_count":{"one":"1 Badge","other":"%{count} Badges"},"more_badges":{"one":"+1 Meer","other":"+%{count} Meer"},"granted":{"one":"1 toegekend","other":"%{count} toegekend"},"select_badge_for_title":"Kies een badge om als je titel te gebruiken","no_title":"\u003cgeen titel\u003e","badge_grouping":{"getting_started":{"name":"Aan De Slag"},"other":{"name":"Overige"}},"badge":{"editor":{"name":"Auteur","description":"Eerste berichtwijziging"},"basic_user":{"name":"Basis"},"regular_user":{"name":"Normaal"},"leader":{"name":"Leider"},"elder":{"name":"Stamoudste"},"welcome":{"name":"Welkom","description":"Like ontvangen."},"autobiographer":{"name":"Autobiografist"},"nice_post":{"name":"Prima bericht","description":"10 likes op een post ontvangen. Deze badge kan meerdere keren worden toegekend."},"good_post":{"name":"Goed bericht","description":"25 likes op een post ontvangen. Deze badge kan meerdere keren worden toegekend."},"great_post":{"name":"Fantastisch bericht","description":"50 likes op een post ontvangen. Deze badge kan meerdere keren worden toegekend."},"first_like":{"name":"Eerste like","description":"Hebt een bericht ge-vind-ik-leukt"},"first_flag":{"name":"Eerste markering","description":"Een bericht gemarkeerd"},"first_share":{"name":"Eerste deel actie","description":"Een bericht gedeeld"},"first_link":{"name":"Eerste link","description":"Een interne link toegevoegd aan een ander topic"},"first_quote":{"name":"Eerste citaat","description":"Een gebruiker geciteerd"},"read_guidelines":{"name":"Heeft de richtlijnen gelezen","description":"Lees de \u003ca href=\"/guidelines\"\u003ecommunity richtlijnen\u003c/a\u003e"},"reader":{"name":"Lezer","description":"Lees elk bericht in een topic met meer dan 100 berichten."}}}}}};
I18n.locale = 'nl';
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
// locale : dutch (nl)
// author : Joris Röling : https://github.com/jjupiter

(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define(['moment'], factory); // AMD
    } else if (typeof exports === 'object') {
        module.exports = factory(require('../moment')); // Node
    } else {
        factory(window.moment); // Browser global
    }
}(function (moment) {
    var monthsShortWithDots = "jan._feb._mrt._apr._mei_jun._jul._aug._sep._okt._nov._dec.".split("_"),
        monthsShortWithoutDots = "jan_feb_mrt_apr_mei_jun_jul_aug_sep_okt_nov_dec".split("_");

    return moment.defineLocale('nl', {
        months : "januari_februari_maart_april_mei_juni_juli_augustus_september_oktober_november_december".split("_"),
        monthsShort : function (m, format) {
            if (/-MMM-/.test(format)) {
                return monthsShortWithoutDots[m.month()];
            } else {
                return monthsShortWithDots[m.month()];
            }
        },
        weekdays : "zondag_maandag_dinsdag_woensdag_donderdag_vrijdag_zaterdag".split("_"),
        weekdaysShort : "zo._ma._di._wo._do._vr._za.".split("_"),
        weekdaysMin : "Zo_Ma_Di_Wo_Do_Vr_Za".split("_"),
        longDateFormat : {
            LT : "HH:mm",
            L : "DD-MM-YYYY",
            LL : "D MMMM YYYY",
            LLL : "D MMMM YYYY LT",
            LLLL : "dddd D MMMM YYYY LT"
        },
        calendar : {
            sameDay: '[vandaag om] LT',
            nextDay: '[morgen om] LT',
            nextWeek: 'dddd [om] LT',
            lastDay: '[gisteren om] LT',
            lastWeek: '[afgelopen] dddd [om] LT',
            sameElse: 'L'
        },
        relativeTime : {
            future : "over %s",
            past : "%s geleden",
            s : "een paar seconden",
            m : "één minuut",
            mm : "%d minuten",
            h : "één uur",
            hh : "%d uur",
            d : "één dag",
            dd : "%d dagen",
            M : "één maand",
            MM : "%d maanden",
            y : "één jaar",
            yy : "%d jaar"
        },
        ordinal : function (number) {
            return number + ((number === 1 || number === 8 || number >= 20) ? 'ste' : 'de');
        },
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });
}));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY H:mm'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
