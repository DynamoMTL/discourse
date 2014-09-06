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
MessageFormat.locale.de = function ( n ) {
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
r += "Du ";
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
r += "hast <a href='/unread'>eine ungelesene</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "hast <a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " ungelesene</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["de"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "und ";
return r;
},
"false" : function(d){
var r = "";
r += "ist ";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='/new'>ein neues</a> Thema";
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
r += "und ";
return r;
},
"false" : function(d){
var r = "";
r += "sind ";
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
})() + " neue</a> Themen";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["de"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " übrig, oder ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "entdecke andere Themen in ";
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
} , "posts_likes_MF" : function(d){
var r = "";
r += "Dieses Thema hat ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 Beitrag";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " Beiträge";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["de"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "ratio";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"low" : function(d){
var r = "";
r += "mit einem hohen Verhältnis von Likes zu Beiträgen";
return r;
},
"med" : function(d){
var r = "";
r += "mit einem sehr hohen Verhältnis von Likes zu Beiträgen";
return r;
},
"high" : function(d){
var r = "";
r += "mit einem extrem hohen Verhältnis von Likes zu Beiträgen";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
r += "\n";
return r;
}});I18n.translations = {"de":{"js":{"number":{"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}}},"dates":{"time":"HH:mm","long_no_year":"DD. MMM HH:mm","long_no_year_no_time":"DD. MMM","long_with_year":"DD. MMM YYYY HH:mm","long_with_year_no_time":"DD. MMM YYYY","long_date_with_year":"DD. MMM 'YY HH:mm","long_date_without_year":"DD. MMM HH:mm","long_date_with_year_without_time":"DD. MMM 'YY","long_date_without_year_with_linebreak":"DD. MMM\u003cbr/\u003eHH:mm","long_date_with_year_with_linebreak":"DD. MMM 'YY\u003cbr/\u003eHH:mm","tiny":{"half_a_minute":"\u003c 1min","less_than_x_seconds":{"one":"\u003c 1s","other":"\u003c %{count}s"},"x_seconds":{"one":"1s","other":"%{count}s"},"less_than_x_minutes":{"one":"\u003c 1min","other":"\u003c %{count}min"},"x_minutes":{"one":"1min","other":"%{count}min"},"about_x_hours":{"one":"1h","other":"%{count}h"},"x_days":{"one":"1d","other":"%{count}d"},"about_x_years":{"one":"1a","other":"%{count}a"},"over_x_years":{"one":"\u003e 1a","other":"\u003e %{count}a"},"almost_x_years":{"one":"1a","other":"%{count}a"},"date_month":"DD. MMM","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"1 Minute","other":"%{count} Minuten"},"x_hours":{"one":"1 Stunde","other":"%{count} Stunden"},"x_days":{"one":"1 Tag","other":"%{count} Tage"},"date_year":"DD. MMM 'YY"},"medium_with_ago":{"x_minutes":{"one":"vor einer Minute","other":"vor %{count} Minuten"},"x_hours":{"one":"vor einer Stunde","other":"vor %{count} Stunden"},"x_days":{"one":"vor einem Tag","other":"vor %{count} Tagen"}}},"share":{"topic":"Teile einen Link zu diesem Thema","post":"Teile einen Link zu Beitrag Nr. %{postNumber}","close":"Schließen","twitter":"diesen Link auf Twitter teilen","facebook":"diesen Link auf Facebook teilen","google+":"diesen Link auf Google+ teilen","email":"diesen Link per E-Mail senden"},"edit":"Titel und Kategorie dieses Themas ändern","not_implemented":"Tut uns leid, diese Funktion wurde noch nicht implementiert!","no_value":"Nein","yes_value":"Ja","generic_error":"Entschuldigung. Ein Fehler ist aufgetreten.","generic_error_with_reason":"Ein Fehler ist aufgetreten: %{error}","sign_up":"Registrieren","log_in":"Anmelden","age":"Alter","joined":"Beigetreten","admin_title":"Administration","flags_title":"Meldungen","show_more":"mehr anzeigen","links":"Links","links_lowercase":"Links","faq":"FAQ","guidelines":"Richtlinien","privacy_policy":"Datenschutzrichtlinie","privacy":"Datenschutz","terms_of_service":"Nutzungsbedingungen","mobile_view":"Mobile Ansicht","desktop_view":"Desktop Ansicht","you":"Du","or":"oder","now":"gerade eben","read_more":"weiterlesen","more":"Mehr","less":"Weniger","never":"nie","daily":"täglich","weekly":"wöchentlich","every_two_weeks":"jede zweite Woche","max":"max.","character_count":{"one":"{{count}} Zeichen","other":"{{count}} Zeichen"},"in_n_seconds":{"one":"in einer Sekunde","other":"in {{count}} Sekunden"},"in_n_minutes":{"one":"in einer Minute","other":"in {{count}} Minuten"},"in_n_hours":{"one":"in einer Stunde","other":"in {{count}} Stunden"},"in_n_days":{"one":"in einem Tag","other":"in {{count}} Tagen"},"suggested_topics":{"title":"Vorgeschlagene Themen"},"about":{"simple_title":"Über","title":"Über %{title}","stats":"Website-Statistiken","our_admins":"Unsere Administratoren","our_moderators":"Unsere Moderatoren","stat":{"all_time":"Gesamt","last_7_days":"Letzte 7 Tage"},"like_count":"Anzahl der Likes","topic_count":"Anzahl der Themen","post_count":"Anzahl der Beiträge","user_count":"Anzahl der Benutzer"},"bookmarks":{"not_logged_in":"Entschuldigung, du musst eingeloggt sein, um ein Lesezeichen zu setzen.","created":"du hast ein Lesezeichen zu diesem Beitrag hinzugefügt","not_bookmarked":"Du hast diesen Beitrag gelesen. Klicke, um ein Lesezeichen zu setzen.","last_read":"Das ist der letzte Beitrag, den du gelesen hast. Klicke, um ein Lesezeichen zu setzen.","remove":"Entferne Lesezeichen"},"topic_count_latest":{"one":"{{count}} neues oder geändertes Thema.","other":"{{count}} neue oder geänderte Themen."},"topic_count_unread":{"one":"{{count}} ungelesenes Thema.","other":"{{count}} ungelesene Themen."},"topic_count_new":{"one":"{{count}} neues Thema.","other":"{{count}} neue Themen."},"click_to_show":"Klicke zum Anzeigen.","preview":"Vorschau","cancel":"Abbrechen","save":"Änderungen speichern","saving":"Speichere...","saved":"Gespeichert!","upload":"Hochladen","uploading":"Wird hochgeladen...","uploaded":"Hochgeladen!","enable":"Aktivieren","disable":"Deaktivieren","undo":"Rückgängig machen","revert":"Verwerfen","failed":"Fehlgeschlagen","banner":{"close":"Diesen Banner ausblenden."},"choose_topic":{"none_found":"Keine Themen gefunden.","title":{"search":"Suche nach Thema anhand von Name, URL oder ID:","placeholder":"Gib hier den Titel des Themas ein"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e hat \u003ca href='{{topicUrl}}'\u003edas Thema\u003c/a\u003e verfasst","you_posted_topic":"\u003ca href=\"{{userUrl}}\"\u003eDu\u003c/a\u003e hast \u003ca href=\"{{topicUrl}}\"\u003edas Thema\u003c/a\u003e verfasst","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e hat auf \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e geantwortet","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eDu\u003c/a\u003e hast auf \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e geantwortet","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e hat auf \u003ca href='{{topicUrl}}'\u003edas Thema\u003c/a\u003e geantwortet","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eDu\u003c/a\u003e hast auf \u003ca href='{{topicUrl}}'\u003edas Thema\u003c/a\u003e geantwortet","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e hat \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e erwähnt","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e hat \u003ca href='{{user2Url}}'\u003edich\u003c/a\u003e erwähnt","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eDu\u003c/a\u003e hast \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e erwähnt","posted_by_user":"Geschrieben von \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Von \u003ca href='{{userUrl}}'\u003edir\u003c/a\u003e geschrieben","sent_by_user":"Von \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e gesendet","sent_by_you":"Von \u003ca href='{{userUrl}}'\u003edir\u003c/a\u003e gesendet"},"groups":{"visible":"Gruppe ist für alle Benutzer sichtbar","title":{"one":"Gruppe","other":"Gruppen"},"members":"Mitglieder","posts":"Beiträge","alias_levels":{"title":"Wer kann diese Gruppe als Alias verwenden?","nobody":"Niemand","only_admins":"Nur Administratoren","mods_and_admins":"Nur Moderatoren und Administratoren","members_mods_and_admins":"Nur Gruppenmitglieder, Moderatoren und Administratoren","everyone":"Jeder"}},"user_action_groups":{"1":"Abgegebene Likes","2":"Erhaltene Likes","3":"Lesezeichen","4":"Themen","5":"Beiträge","6":"Antworten","7":"Erwähnungen","9":"Zitate","10":"Favoriten","11":"Änderungen","12":"Gesendete Objekte","13":"Posteingang"},"categories":{"all":"Alle Kategorien","all_subcategories":"alle","no_subcategory":"keine","category":"Kategorie","posts":"Beiträge","topics":"Themen","latest":"Aktuelle Themen","latest_by":"neuester Beitrag von","toggle_ordering":"Reihenfolge ändern","subcategories":"Unterkategorien","topic_stats":"Die Anzahl der neuen Themen.","topic_stat_sentence":{"one":"1 neues Thema seit 1 %{unit}.","other":"%{count} neue Themen seit 1 %{unit}."},"post_stats":"Die Anzahl der neuen Beiträge.","post_stat_sentence":{"one":"1 neuer Beitrag seit 1 %{unit}.","other":"%{count} neue Beiträge seit 1 %{unit}."}},"ip_lookup":{"title":"IP-Adressen-Abfrage","hostname":"Hostname","location":"Standort","location_not_found":"(unbekannt)","organisation":"Organisation","phone":"Telefon","other_accounts":"Andere Konten mit dieser IP-Adresse","no_other_accounts":"(keine)"},"user":{"said":"{{username}} sagte:","profile":"Profil","mute":"Stummschalten","edit":"Einstellungen bearbeiten","download_archive":"Ein Archiv meiner Beiträge herunterladen","private_message":"Private Nachricht","private_messages":"Nachrichten","activity_stream":"Aktivität","preferences":"Einstellungen","bookmarks":"Lesezeichen","bio":"Über mich","invited_by":"Eingeladen von","trust_level":"Vertrauensstufe","notifications":"Benachrichtigungen","disable_jump_reply":"Nach Verfassen einer Antwort nicht zum neuen Beitrag springen","dynamic_favicon":"Zeige Benachrichtigungen über eingehende Nachrichten im Favicon (experimentell)","edit_history_public":"Andere Benutzer dürfen in Beiträgen meine Überarbeitungen sehen.","external_links_in_new_tab":"Öffne alle externen Links in einem neuen Tab","enable_quoting":"Aktiviere Zitatantwort mit dem hervorgehobenen Text","change":"ändern","moderator":"{{user}} ist ein Moderator","admin":"{{user}} ist ein Administrator","moderator_tooltip":"Dieser Benutzer ist ein Moderator","admin_tooltip":"Dieser Benutzer ist ein Administrator","suspended_notice":"Dieser Benutzer ist bis zum {{date}} gesperrt.","suspended_reason":"Grund: ","mailing_list_mode":"Erhalte bei jedem neuen Beitrag eine E-Mail (sofern du das Thema oder die Kategorie nicht stummgeschaltet hast)","watched_categories":"Beobachtet","watched_categories_instructions":"Du wirst in diesen Kategorien automatisch alle neuen Themen beobachten. Du wirst über alle neuen Beiträge und Themen benachrichtigt werden. Außerdem wird die Anzahl der ungelesenen und neuen Beiträge neben dem Eintrag in der Themenliste angezeigt.","tracked_categories":"Verfolgt","tracked_categories_instructions":"Du wirst in diesen Kategorien automatisch allen neuen Themen folgen. Die Anzahl der ungelesenen und neuen Beiträge wird neben dem Eintrag in der Themenliste angezeigt.","muted_categories":"Stummgeschaltet","muted_categories_instructions":"Du erhältst keine Benachrichtigungen über neue Themen in diesen Kategorien und sie werden nicht in deiner Liste ungelesener Themen aufscheinen.","delete_account":"Lösche mein Benutzerkonto","delete_account_confirm":"Möchtest du wirklich dein Benutzerkonto permanent löschen? Diese Aktion kann nicht rückgängig gemacht werden!","deleted_yourself":"Dein Benutzerkonto wurde erfolgreich gelöscht.","delete_yourself_not_allowed":"Du kannst im Moment dein Benutzerkonto nicht löschen. Kontaktiere einen Administrator, um dein Benutzerkonto löschen zu lassen.","unread_message_count":"Nachrichten","staff_counters":{"flags_given":"hilfreiche Meldungen abgegeben","flagged_posts":"gemeldete Beiträge","deleted_posts":"gelöschte Beiträge","suspensions":"Sperren"},"messages":{"all":"Alle","mine":"Meine","unread":"Ungelesen"},"change_password":{"success":"(E-Mail gesendet)","in_progress":"(E-Mail wird gesendet)","error":"(Fehler)","action":"Sende eine E-Mail zum Zurücksetzen des Passworts","set_password":"Passwort ändern"},"change_about":{"title":"„Über mich“ ändern"},"change_username":{"title":"Benutzernamen ändern","confirm":"Wenn du deinen Benutzernamen änderst, werden alle derzeit vorhandenen Zitate deiner Beiträge und alle Erwähnungen per @Name nicht mehr funktionieren. Bist du dir absolut sicher, dass du fortfahren willst?","taken":"Der Benutzername ist bereits vergeben.","error":"Bei der Änderung deines Benutzernamens ist ein Fehler aufgetreten.","invalid":"Der Benutzernamen ist nicht zulässig. Er darf nur Zahlen und Buchstaben enthalten."},"change_email":{"title":"E-Mail-Adresse ändern","taken":"Es tut uns leid. Diese E-Mail-Adresse ist nicht verfügbar.","error":"Beim Ändern der E-Mail-Adresse ist ein Fehler aufgetreten. Möglicherweise wird diese Adresse schon benutzt.","success":"Wir haben eine E-Mail an die angegebene E-Mail-Adresse gesendet. Folge zur Bestätigung der Adresse bitte den darin enthaltenen Anweisungen."},"change_avatar":{"title":"Deinen Avatar ändern","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, basierend auf","refresh_gravatar_title":"Deinen Gravatar aktualisieren","letter_based":"Automatisch generierter Avatar","uploaded_avatar":"Eigenes Bild","uploaded_avatar_empty":"Eigenes Bild hinzufügen","upload_title":"Lade dein Bild hoch","upload_picture":"Bild hochladen","image_is_not_a_square":"Achtung: wir haben dein Bild zugeschnitten, da es nicht quadratisch war."},"change_profile_background":{"title":"Profilhintergrund"},"email":{"title":"E-Mail","instructions":"Wird niemals öffentlich angezeigt.","ok":"Schaut gut aus. Wir schicken dir eine E-Mail zur Bestätigung.","invalid":"Bitte gib eine gültige E-Mail-Adresse ein.","authenticated":"Deine E-Mail-Adresse wurde von {{provider}} bestätigt.","frequency":"Wir werden dir nur E-Mails senden, wenn wir dich kürzlich nicht gesehen haben und wenn du die betroffenen Inhalte noch nicht gesehen hast."},"name":{"title":"Name","instructions":"Längere Version deines Namens.","too_short":"Dein Name ist zu kurz.","ok":"Dein Name schaut gut aus."},"username":{"title":"Benutzername","instructions":"Muss eindeutig, ohne Leerzeichen und kurz sein.","short_instructions":"Andere Benutzer können dich mit @{{username}} erwähnen.","available":"Dein Benutzername ist verfügbar.","global_match":"Die E-Mail-Adresse stimmt mit dem registrierten Benutzernamen überein.","global_mismatch":"Bereits registriert. Wie wäre es mit {{suggestion}}?","not_available":"Nicht verfügbar. Wie wäre es mit {{suggestion}}?","too_short":"Dein Benutzername ist zu kurz.","too_long":"Dein Benutzername ist zu lang.","checking":"Überprüfe die Verfügbarkeit des Benutzernamens...","enter_email":"Benutzername gefunden. Gib die zugehörige E-Mail-Adresse ein.","prefilled":"Die E-Mail-Adresse passt zu diesem registrierten Benutzernamen."},"locale":{"title":"Oberflächensprache","instructions":"Die Sprache der Forumsoberfläche. Diese Änderung tritt nach dem Neuladen der Seite in Kraft.","default":"(Standard)"},"password_confirmation":{"title":"Wiederholung des Passworts"},"last_posted":"Letzter Beitrag","last_emailed":"Letzte E-Mail","last_seen":"Zuletzt gesehen","created":"Mitglied seit","log_out":"Abmelden","location":"Wohnort","website":"Website","email_settings":"E-Mail","email_digests":{"title":"Schicke eine E-Mail mit Neuigkeiten, wenn ich die Website länger nicht besuche:","daily":"täglich","weekly":"wöchentlich","bi_weekly":"alle zwei Wochen"},"email_direct":"Schicke eine E-Mail, wenn mich jemand zitiert, auf meine Beiträge antwortet oder meinen @Namen erwähnt.","email_private_messages":"Schicke eine E-Mail, wenn mir jemand eine private Nachricht sendet.","email_always":"E-Mail-Benachrichtigungen nicht unterdrücken, während ich im Forum aktiv bin","other_settings":"Andere","categories_settings":"Kategorien","new_topic_duration":{"label":"Themen als neu ansehen, wenn","not_viewed":"ich sie noch nicht betrachtet habe","last_here":"seit meinem letzten Besuch erstellt","after_n_days":{"one":"vor einem Tag erstellt","other":"in den letzten {{count}} Tagen erstellt"},"after_n_weeks":{"one":"in der letzten Woche erstellt","other":"in den letzten {{count}} Wochen erstellt"}},"auto_track_topics":"Betrachteten Themen automatisch folgen","auto_track_options":{"never":"niemals","always":"immer","after_n_seconds":{"one":"nach einer Sekunde","other":"nach {{count}} Sekunden"},"after_n_minutes":{"one":"nach einer Minute","other":"nach {{count}} Minuten"}},"invited":{"search":"schreib zum Suchen nach Einladungen...","title":"Einladungen","user":"Eingeladener Benutzer","none":"Du hast bis jetzt noch niemanden hierher eingeladen.","truncated":"Zeige die ersten {{count}} Einladungen.","redeemed":"Angenommene Einladungen","redeemed_at":"Angenommen","pending":"Ausstehende Einladungen","topics_entered":"Betrachtete Themen","posts_read_count":"Gelesene Beiträge","expired":"Diese Einladung ist abgelaufen.","rescind":"Einladung zurücknehmen","rescinded":"Einladung zurückgenommen","time_read":"Lesezeit","days_visited":"Besuchstage","account_age_days":"Konto-Alter in Tagen","create":"Einladung versenden","bulk_invite":{"none":"Du hast noch niemanden hierher eingeladen. Du kannst individuelle Einladungen verschicken oder eine Masseneinladung an eine Gruppe von Leuten verschicken indem du \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003eeine Datei für Masseneinladung\u003c/a\u003e hochlädst.","text":"Masseneinladung aus Datei","uploading":"wird hochgeladen","success":"Datei erfolgreich hochgeladen. Du wirst in Kürze über den Fortschritt benachrichtigt.","error":"Beim Hochladen der Datei '{{filename}}' ist ein Fehler aufgetreten: {{message}}"}},"password":{"title":"Passwort","too_short":"Dein Passwort ist zu kurz.","common":"Das Passwort wird zu häufig verwendet.","ok":"Dein Passwort sieht gut aus.","instructions":"Muss mindestens %{count} Zeichen lang sein."},"ip_address":{"title":"Letzte IP-Adresse"},"registration_ip_address":{"title":"IP-Adresse bei Registrierung"},"avatar":{"title":"Avatar"},"title":{"title":"Titel"},"filters":{"all":"Alle"},"stream":{"posted_by":"Verfasst von","sent_by":"Gesendet von","private_message":"Private Nachricht","the_topic":"das Thema"}},"loading":"Wird geladen...","errors":{"prev_page":"während des Ladens","reasons":{"network":"Netzwerkfehler","server":"Server-Fehler","forbidden":"Zugriff verweigert","unknown":"Fehler"},"desc":{"network":"Bitte überprüfe deine Netzwerkverbindung.","network_fixed":"Sieht aus, als wäre es wieder da.","server":"Fehlercode: {{status}}","unknown":"Etwas ist schief gelaufen."},"buttons":{"back":"Zurück","again":"Erneut versuchen","fixed":"Seite laden"}},"close":"Schließen","assets_changed_confirm":"Diese Website wurde gerade aktualisiert. Neu laden für die neuste Version?","read_only_mode":{"enabled":"Ein Administrator hat den Nur-Lesen-Modus aktiviert. Du kannst die Website weiter durchsuchen und lesen. Einige Funktionen werden jedoch wahrscheinlich nicht funktionieren.","login_disabled":"Die Anmeldung ist deaktiviert während sich die Website im Nur-Lesen-Modus befindet."},"too_few_topics_notice":"Erstelle mindestens 5 öffentlich sichtbare Themen und %{posts} öffentlich sichtbare Beiträge, um die Unterhaltung ins Rollen zu bringen. Neue Benutzer können ihre Vertrauensstufe nur erhöhen, wenn es für sie etwas zu Lesen gibt. Diese Meldung wird nur Mitarbeitern angezeigt.","learn_more":"mehr erfahren...","year":"Jahr","year_desc":"Themen, die in den letzten 365 Tagen erstellt wurden","month":"Monat","month_desc":"Themen, die in den letzten 30 Tagen erstellt wurden","week":"Woche","week_desc":"Themen, die in den letzten 7 Tagen erstellt wurden","day":"Tag","first_post":"Erster Beitrag","mute":"Stummschalten","unmute":"Stummschaltung aufheben","last_post":"Letzter Beitrag","last_post_lowercase":"letzter Beitrag","summary":{"enabled_description":"Du siehst gerade eine Zusammenfassung des Themas: die interessantesten Beiträge, die von der Community bestimmt wurden.","description":"Es gibt \u003cb\u003e{{count}}\u003c/b\u003e Antworten.","description_time":"Es gibt \u003cb\u003e{{count}}\u003c/b\u003e Antworten mit einer geschätzten Lesezeit von \u003cb\u003e{{readingTime}} Minuten\u003c/b\u003e.","enable":"Zusammenfassung vom Thema erstellen","disable":"Alle Beiträge anzeigen"},"deleted_filter":{"enabled_description":"Dieses Thema enthält gelöschte Beiträge, die derzeit ausgeblendet sind.","disabled_description":"Gelöschte Beiträge werden in diesem Thema angezeigt.","enable":"Gelöschte Beiträge ausblenden","disable":"Gelöschte Beiträge anzeigen"},"private_message_info":{"title":"Private Nachricht","invite":"Andere einladen...","remove_allowed_user":"Willst du {{name}} wirklich aus dieser privaten Unterhaltung entfernen?"},"email":"E-Mail-Adresse","username":"Benutzername","last_seen":"Zuletzt gesehen","created":"Erstellt","created_lowercase":"erstellt","trust_level":"Vertrauensstufe","search_hint":"Benutzername oder E-Mail-Adresse","create_account":{"title":"Neues Benutzerkonto erstellen","failed":"Etwas ist fehlgeschlagen. Vielleicht ist diese E-Mail-Adresse bereits registriert. Versuche den 'Passwort vergessen'-Link."},"forgot_password":{"title":"Passwort vergessen","action":"Ich habe mein Passwort vergessen","invite":"Gib deinen Benutzernamen oder deine E-Mail-Adresse ein. Wir senden dir eine E-Mail zum Zurücksetzen des Passworts.","reset":"Passwort zurücksetzen","complete_username":"Wenn ein Benutzerkonto dem Benutzernamen \u003cb\u003e%{username}\u003c/b\u003e entspricht, solltest du in Kürze eine E-Mail mit Anweisungen zum Zurücksetzen deines Passwortes erhalten.","complete_email":"Wenn ein Benutzerkonto der E-Mail \u003cb\u003e%{email}\u003c/b\u003e entspricht, solltest du in Kürze eine E-Mail mit Anweisungen zum Zurücksetzen deines Passwortes erhalten."},"login":{"title":"Anmelden","username":"Benutzername","password":"Passwort","email_placeholder":"E-Mail oder Benutzername","caps_lock_warning":"Feststelltaste ist aktiviert","error":"Unbekannter Fehler","blank_username_or_password":"Bitte gib deine E-Mail-Adresse oder deinen Benutzernamen und dein Passwort ein.","reset_password":"Passwort zurücksetzen","logging_in":"Anmeldung läuft...","or":"Oder","authenticating":"Authentifiziere...","awaiting_confirmation":"Dein Konto ist noch nicht aktiviert. Verwende den 'Passwort vergessen'-Link, um eine weitere E-Mail mit Anweisungen zur Aktivierung zu erhalten.","awaiting_approval":"Dein Konto wurde noch nicht von einem Mitarbeiter genehmigt. Du bekommst eine E-Mail, sobald das geschehen ist.","requires_invite":"Entschuldige, der Zugriff auf dieses Forum ist nur mit einer Einladung möglich.","not_activated":"Du kannst dich noch nicht einloggen. Wir haben dir schon eine E-Mail zur Aktivierung an \u003cb\u003e{{sentTo}}\u003c/b\u003e geschickt. Bitte folge den Anweisungen in dieser E-Mail, um dein Benutzerkonto zu aktivieren.","resend_activation_email":"Klicke hier um eine neue Aktivierungsmail zu schicken.","sent_activation_email_again":"Wir haben dir eine weitere E-Mail zur Aktivierung an \u003cb\u003e{{currentEmail}}\u003c/b\u003e geschickt. Es könnte ein paar Minuten dauern, bis diese ankommt; sieh auch im Spam-Ordner nach.","google":{"title":"mit Google","message":"Authentifiziere mit Google (stelle sicher, dass keine Pop-up-Blocker aktiviert sind)"},"google_oauth2":{"title":"mit Google","message":"Authentifiziere mit Google (stelle sicher, dass keine Pop-up-Blocker aktiviert sind)"},"twitter":{"title":"mit Twitter","message":"Authentifiziere mit Twitter (stelle sicher, dass keine Pop-up-Blocker aktiviert sind)"},"facebook":{"title":"mit Facebook","message":"Authentifiziere mit Facebook (stelle sicher, dass keine Pop-up-Blocker aktiviert sind)"},"yahoo":{"title":"mit Yahoo","message":"Authentifiziere mit Yahoo (stelle sicher, dass keine Pop-up-Blocker aktiviert sind)"},"github":{"title":"mit GitHub","message":"Authentifiziere mit GitHub (stelle sicher, dass keine Pop-up-Blocker aktiviert sind)"}},"composer":{"posting_not_on_topic":"Auf welches Thema möchtest du antworten?","saving_draft_tip":"speichere","saved_draft_tip":"gespeichert","saved_local_draft_tip":"lokal gespeichert","similar_topics":"Dein Thema hat Ähnlichkeit mit...","drafts_offline":"Entwürfe offline","min_length":{"need_more_for_title":"im Titel fehlen noch {{n}} Zeichen","need_more_for_reply":"im Beitrag fehlen noch {{n}} Zeichen"},"error":{"title_missing":"Titel ist erforderlich","title_too_short":"Titel muss mindestens {{min}} Zeichen lang sein","title_too_long":"Titel darf maximal {{max}} Zeichen lang sein","post_missing":"Beitrag darf nicht leer sein","post_length":"Beitrag muss mindestens {{min}} Zeichen lang sein","category_missing":"Du musst eine Kategorie auswählen"},"save_edit":"Änderungen speichern","reply_original":"Auf das ursprünglichen Thema antworten","reply_here":"Hier antworten","reply":"Antworten","cancel":"Abbrechen","create_topic":"Thema erstellen","create_pm":"Private Nachricht verfassen","title":"Oder drücke Strg+Eingabetaste","users_placeholder":"Benutzer hinzufügen","title_placeholder":"Um was geht es in dieser Diskussion? Schreib einen kurzen Satz.","edit_reason_placeholder":"Warum bearbeitest du?","show_edit_reason":"(Bearbeitungsgrund hinzufügen)","reply_placeholder":"Schreib hier. Verwende Markdown oder BBCode zur Formatierung. Füge ein Bild ein oder ziehe es herein, um es hochzuladen.","view_new_post":"Sieh deinen neuen Beitrag an.","saving":"Speichere...","saved":"Gespeichert!","saved_draft":"Du hast einen Beitrag als Entwurf gespeichert. Aktiviere diese Leiste, um den Entwurf zu bearbeiten.","uploading":"Wird hochgeladen...","show_preview":"Vorschau anzeigen \u0026raquo;","hide_preview":"\u0026laquo; Vorschau ausblenden","quote_post_title":"Ganzen Beitrag zitieren","bold_title":"Fettgedruckt","bold_text":"Fettgedruckter Text","italic_title":"Betonung","italic_text":"Betonter Text","link_title":"Hyperlink","link_description":"gib hier eine Link-Beschreibung ein","link_dialog_title":"Hyperlink einfügen","link_optional_text":"Optionaler Titel","quote_title":"Zitat","quote_text":"Zitat","code_title":"Vorformatierter Text","code_text":"vorformatierten Text mit 4 Leerzeichen einrücken","upload_title":"Upload","upload_description":"gib hier eine Beschreibung des Uploads ein","olist_title":"Nummerierte Liste","ulist_title":"Liste mit Aufzählungszeichen","list_item":"Listenelement","heading_title":"Überschrift","heading_text":"Überschrift","hr_title":"Horizontale Linie","undo_title":"Rückgängig machen","redo_title":"Wiederholen","help":"Hilfe zur Markdown-Formatierung","toggler":"Eingabebereich aus- oder einblenden","admin_options_title":"Optionale Mitarbeiter-Einstellungen für dieses Thema","auto_close_label":"Schließe das Thema automatisch nach:","auto_close_units":"(Stunden, Uhrzeit oder Datum)","auto_close_examples":"Gib eine Anzahl von Stunden, eine Uhrzeit oder ein Datum ein — 24, 17:00, 2013-11-22 14:00","auto_close_error":"Bitte einen gültigen Wert eingeben."},"notifications":{"title":"Benachrichtigung über Erwähnungen mit @Name, Antworten auf deine Beiträge und Themen, private Nachrichten etc.","none":"Du hast momentan keine Benachrichtigungen.","more":"ältere Benachrichtigungen anzeigen","total_flagged":"Anzahl der gemeldeten Beiträge","mentioned":"\u003ci title='erwähnt' class='icon'\u003e@\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='zitiert' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='geantwortet' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='geantwortet' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='bearbeitet' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='gefällt' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","private_message":"\u003ci title='private Nachricht' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='private Nachricht' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='Einladung angenommen' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e hat deine Einladung angenommen\u003c/p\u003e","moved_post":"\u003ci title='Beitrag verschoben' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e hat {{description}} verschoben\u003c/p\u003e","linked":"\u003ci title='Beitrag verlinkt' class='fa fa-arrow-left'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='Abzeichen verliehen' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eAbzeichen '{{description}}' erhalten\u003c/p\u003e"},"upload_selector":{"title":"Ein Bild hinzufügen","title_with_attachments":"Ein Bild oder eine Datei hinzufügen","from_my_computer":"Von meinem Gerät","from_the_web":"Aus dem Web","remote_tip":"Link zu Bild http://example.com/image.jpg","remote_tip_with_attachments":"Link zu Bild oder Datei http://example.com/file.ext (erlaubte Dateiendungen: {{authorized_extensions}}).","local_tip":"Klicke hier, um ein Bild von deinem Gerät zu wählen.","local_tip_with_attachments":"Klicke hier, um ein Bild oder eine Datei von deinem Gerät zu wählen (erlaubte Dateiendungen: {{authorized_extensions}})","hint":"(du kannst Dateien auch in den Editor ziehen, um diese hochzuladen)","hint_for_supported_browsers":"(du kannst Bilder auch durch Ziehen in den Editor oder durch Einfügen aus der Zwischenablage hochladen)","uploading":"Wird hochgeladen","image_link":"Der Link deines Bildes verweist auf"},"search":{"title":"suche nach Themen, Beiträgen, Benutzern oder Kategorien","no_results":"Keine Ergebnisse gefunden.","searching":"Suche ...","post_format":"#{{post_number}} von {{username}}","context":{"user":"Beiträge von @{{username}} durchsuchen","category":"Kategorie „{{category}}“ durchsuchen","topic":"Dieses Thema durchsuchen"}},"site_map":"zu einer anderen Themenliste oder Kategorie wechseln","go_back":"zurückgehen","not_logged_in_user":"Benutzerseite mit einer Zusammenfassung der Benutzeraktivitäten und Einstellungen","current_user":"zu deiner Benutzerseite gehen","starred":{"title":"Favoriten","help":{"star":"Füge dieses Thema deinen Favoriten hinzu","unstar":"Entferne dieses Thema aus deinen Favoriten"}},"topics":{"bulk":{"reset_read":"Gelesene zurücksetzen","delete":"Themen löschen","dismiss_posts":"Beiträge ignorieren","dismiss_posts_tooltip":"Neue Beiträge in diesen Themen ignorieren. Die Themen aber später wieder als ungelesen anzeigen, sobald neue Beiträge verfasst werden.","dismiss_topics":"Themen ignorieren","dismiss_topics_tooltip":"Diese Themen ignorieren und nicht mehr als ungelesen anzeigen, selbst wenn neue Beiträge verfasst werden.","dismiss_new":"Verwerfe neue Themen","toggle":"zu Massenoperationen auf Themen umschalten","actions":"Massenoperationen","change_category":"Kategorie ändern","close_topics":"Themen schließen","notification_level":"Benachrichtigungsstufe ändern","selected":{"one":"Du hast \u003cb\u003eein\u003c/b\u003e Thema ausgewählt.","other":"Du hast \u003cb\u003e{{count}}\u003c/b\u003e Themen ausgewählt."}},"none":{"starred":"Du hast noch keine Themen favorisiert. Um ein Thema zu favorisieren, klicke auf den Stern neben dem Titel.","unread":"Du hast alle Themen gelesen.","new":"Es gibt für dich keine neuen Themen.","read":"Du hast noch keine Themen gelesen.","posted":"Du hast noch keine Beiträge verfasst.","latest":"Es gibt keine aktuellen Themen. Das ist schade.","hot":"Es gibt keine beliebten Themen.","category":"Es gibt keine Themen in {{category}}.","top":"Es gibt keine Top-Themen.","educate":{"new":"\u003cp\u003eStandardmäßig werden Themen als neu angesehen, wenn diese in den letzten 2 Tagen erstellt wurden.\u003c/p\u003e\u003cp\u003eDu kannst das in deinen \u003ca href=\"%{userPrefsUrl}\"\u003eEinstellungen\u003c/a\u003e ändern.\u003c/p\u003e","unread":"\u003cp\u003eStandardmäßig werden Ungelesen-Indikatoren nur für jene Themen angezeigt, die du\u003c/p\u003e\u003cul\u003e\t\u003cli\u003eerstellt,\u003c/li\u003e\u003cli\u003ebeantwortet oder\u003c/li\u003e\u003cli\u003elänger als 4 Minuten gelesen hast.\u003c/li\u003e\u003c/ul\u003e\t\u003cp\u003eDu kannst das in deinen \u003ca href=\"%{userPrefsUrl}\"\u003eEinstellungen\u003c/a\u003e ändern.\u003c/p\u003e\u003cp\u003eAußerdem werden jene Themen berücksichtigt, die du ausdrücklich auf Beobachten oder Verfolgen gesetzt hast.\u003cbr/\u003eDu kannst das in den Benachrichtigungseinstellungen am Ende eines jeden Themas ändern.\u003c/p\u003e"}},"bottom":{"latest":"Das waren die aktuellen Themen.","hot":"Das waren alle beliebten Themen.","posted":"Das waren alle Themen.","read":"Das waren alle gelesenen Themen.","new":"Das waren alle neuen Themen.","unread":"Das waren alle ungelesen Themen.","starred":"Das waren alle favorisierten Themen.","category":"Das waren alle Themen in der Kategorie „{{category}}“.","top":"Das waren alle angesagten Themen."}},"topic":{"filter_to":"{{post_count}} Beiträge im Thema","create":"Thema erstellen","create_long":"Ein neues Thema erstellen","private_message":"Eine private Unterhaltung beginnen","list":"Themen","new":"neues Thema","unread":"ungelesen","new_topics":{"one":"1 neues Thema","other":"{{count}} neue Themen"},"unread_topics":{"one":"1 ungelesenes Thema","other":"{{count}} ungelesene Themen"},"title":"Thema","loading_more":"Lade weitere Themen...","loading":"Thema wird geladen...","invalid_access":{"title":"Thema ist privat","description":"Entschuldige, du hast keinen Zugriff auf dieses Thema!","login_required":"Du musst dich anmelden, damit du dieses Thema sehen kannst."},"server_error":{"title":"Thema konnte nicht geladen werden","description":"Entschuldige, wir konnten das Thema, wahrscheinlich wegen eines Verbindungsfehlers, nicht laden. Bitte versuche es erneut. Wenn das Problem bestehen bleibt, gib uns Bescheid."},"not_found":{"title":"Thema nicht gefunden","description":"Entschuldige, wir konnten dieses Thema nicht finden. Wurde es vielleicht von einem Moderator entfernt?"},"total_unread_posts":{"one":"du hast einen ungelesenen Beitrag in diesem Thema","other":"du hast {{count}} ungelesene Beiträge in diesem Thema"},"unread_posts":{"one":"Du hast einen ungelesenen, alten Beitrag zu diesem Thema","other":"Du hast {{count}} ungelesene, alte Beiträge zu diesem Thema"},"new_posts":{"one":"Es gibt einen neuen Beitrag zu diesem Thema seit du es das letzte Mal gelesen hast","other":"Es gibt {{count}} neue Beiträge zu diesem Thema seit du es das letzte Mal gelesen hast"},"likes":{"one":"Es gibt ein Like in diesem Thema","other":"Es gibt {{count}} Likes in diesem Thema"},"back_to_list":"Zurück zur Themenliste","options":"Themen-Optionen","show_links":"zeige Links innerhalb dieses Themas","toggle_information":"Details zum Thema ein- oder ausblenden","read_more_in_category":"Möchtest du mehr lesen? Entdecke andere Themen in {{catLink}} oder {{latestLink}}.","read_more":"Möchtest du mehr lesen? {{catLink}} oder {{latestLink}}.","browse_all_categories":"Alle Kategorien durchsehen","view_latest_topics":"aktuelle Themen anzeigen","suggest_create_topic":"Möchtest du ein neues Thema erstellen?","jump_reply_up":"zur vorherigen Antwort springen","jump_reply_down":"zur nachfolgenden Antwort springen","deleted":"Das Thema wurde gelöscht","auto_close_notice":"Dieses Thema wird %{timeLeft} automatisch geschlossen.","auto_close_title":"Automatisches Schließen","auto_close_save":"Speichern","auto_close_remove":"Dieses Thema nicht automatisch schließen","progress":{"title":"Themen-Fortschritt","go_top":"Anfang","go_bottom":"Ende","go":"Los","jump_bottom_with_number":"springe zu Beitrag %{post_number}","total":"Beiträge insgesamt","current":"aktueller Beitrag","position":"Beitrag %{current} von %{total}"},"notifications":{"reasons":{"3_6":"Du wirst Benachrichtigungen erhalten, weil du diese Kategorie beobachtest.","3_5":"Du wirst Benachrichtigungen erhalten, weil dieses Thema automatisch von dir beobachtet wird.","3_2":"Du wirst Benachrichtigungen erhalten, weil du dieses Thema beobachtest.","3_1":"Du wirst Benachrichtigungen erhalten, weil du dieses Thema erstellt hast.","3":"Du wirst Benachrichtigungen erhalten, weil du dieses Thema beobachtest.","2_8":"Du wirst Benachrichtigungen erhalten, da du diese Kategorie verfolgst.","2_4":"Du wirst Benachrichtigungen erhalten, weil du eine Antwort zu diesem Thema verfasst hast.","2_2":"Du wirst Benachrichtigungen erhalten, weil du dieses Thema verfolgst.","2":"Du wirst Benachrichtigungen erhalten, weil du \u003ca href=\"/users/{{username}}/preferences\"\u003edieses Thema gelesen hast\u003c/a\u003e.","1_2":"Du wirst nur dann benachrichtigt, wenn jemand deinen @Namen erwähnt oder auf deinen Beitrag antwortet.","1":"Du wirst nur dann benachrichtigt, wenn jemand deinen @Namen erwähnt oder auf deinen Beitrag antwortet.","0_7":"Du ignorierst alle Benachrichtigungen dieser Kategorie.","0_2":"Du ignorierst alle Benachrichtigungen dieses Themas.","0":"Du ignorierst alle Benachrichtigungen dieses Themas."},"watching_pm":{"title":"Beobachten","description":"Du wirst über jede neue Nachricht in dieser privaten Unterhaltung benachrichtigt. Die Anzahl der ungelesenen und neuen Nachrichten wird neben dem Eintrag in der Themenliste angezeigt."},"watching":{"title":"Beobachten","description":"Du wirst über jeden neuen Beitrag in diesem Thema benachrichtigt. Die Anzahl der ungelesenen und neuen Beiträge wird außerdem neben dem Eintrag in der Themenliste angezeigt."},"tracking_pm":{"title":"Verfolgen","description":"Die Anzahl der ungelesenen und neuen Nachrichten wird neben dem Eintrag in der Themenliste angezeigt. Du wirst nur dann benachrichtigt, wenn jemand deinen @Namen erwähnt oder deine Nachricht beantwortet."},"tracking":{"title":"Verfolgen","description":"Die Anzahl der ungelesenen und neuen Beiträge wird neben dem Eintrag in der Themenliste angezeigt. Du wirst nur dann benachrichtigt, wenn jemand deinen @Namen erwähnt oder auf deinen Beitrag antwortet."},"regular":{"title":"Normal","description":"Du wirst nur dann benachrichtigt, wenn jemand deinen @Namen erwähnt oder auf deinen Beitrag antwortet."},"regular_pm":{"title":"Normal","description":"Du wirst nur dann benachrichtigt, wenn jemand deinen @Namen erwähnt oder auf deine Nachricht in der privaten Unterhaltung antwortet."},"muted_pm":{"title":"Stummgeschaltet","description":"Du erhältst keine Benachrichtigungen über diese private Unterhaltung."},"muted":{"title":"Stummgeschaltet","description":"Du erhältst keine Benachrichtigungen über dieses Thema und es wird nicht in deiner Liste ungelesener Themen aufscheinen."}},"actions":{"recover":"Löschen rückgängig machen","delete":"Thema löschen","open":"Thema öffnen","close":"Thema schließen","auto_close":"Automatisch schließen","make_banner":"Banner-Thema","remove_banner":"Kein Banner-Thema","unpin":"Thema loslösen","pin":"Thema anheften","pin_globally":"Thema global anheften","unarchive":"Thema aus Archiv holen","archive":"Thema archivieren","invisible":"Unsichtbar machen","visible":"Sichtbar machen","reset_read":"„Gelesen“ zurücksetzen","multi_select":"Beiträge auswählen"},"reply":{"title":"Antworten","help":"beginne damit eine Antwort auf dieses Thema zu verfassen"},"clear_pin":{"title":"Loslösen","help":"Dieses Thema von der Themenliste loslösen, sodass es nicht mehr am Anfang der Liste steht."},"share":{"title":"Teilen","help":"teile einen Link zu diesem Thema"},"flag_topic":{"title":"Melden","help":"Melde dieses Thema vertraulich zur Kenntnisnahme oder versende eine private Benachrichtigung darüber.","success_message":"Du hast dieses Thema erfolgreich gemeldet."},"inviting":"Einladungen werden gesendet...","automatically_add_to_groups_optional":"Diese Einladung beinhaltet auch Zugang zu den folgenden Gruppen: (optional, nur Admin)","automatically_add_to_groups_required":"Diese Einladung beinhaltet auch Zugang zu folgenden Gruppen: (\u003cb\u003eerforderlich\u003c/b\u003e, nur Admin)","invite_private":{"title":"Zu privater Unterhaltung einladen","email_or_username":"E-Mail-Adresse oder Benutzername des Eingeladenen","email_or_username_placeholder":"E-Mail-Adresse oder Benutzername","action":"Einladen","success":"Wir haben den Benutzer eingeladen, an dieser privaten Unterhaltung teilzunehmen.","error":"Entschuldige, es gab einen Fehler beim Einladen des Benutzers.","group_name":"Gruppenname"},"invite_reply":{"title":"Einladung","action":"Einladung senden","help":"Sendet Freunden eine Einladung, so dass mit einem Klick auf dieses Thema antworten können.","to_topic":"Wir senden deinem Freund eine kurze E-Mail, die es ihm ermöglicht, direkt auf dieses Thema zu antworten. Es ist keine Anmeldung erforderlich.","to_forum":"Wir senden deinem Freund eine kurze E-Mail, die es ihm ermöglicht, dem Forum sofort beizutreten. Es ist keine Anmeldung erforderlich.","email_placeholder":"name@example.com","success":"Wir haben an \u003cb\u003e{{email}}\u003c/b\u003e eine Einladung verschickt. Wir werden dich benachrichtigen, sobald die Einladung angenommen wurde. Auf deiner Benutzerseite kannst du den Status deiner Einladungen verfolgen.","error":"Entschuldige, wir konnten diese Person nicht einladen. Vielleicht ist sie schon ein Nutzer?"},"login_reply":"Anmelden, um zu antworten","filters":{"n_posts":{"one":"1 Beitrag","other":"{{count}} Beiträge"},"cancel":"Zeige in diesem Thema wieder alle Beiträge an."},"split_topic":{"title":"In neues Thema verschieben","action":"in ein neues Thema verschieben","topic_name":"Bezeichnung des neuen Themas","error":"Beim Verschieben der Beiträge ins neue Thema ist ein Fehler aufgetreten.","instructions":{"one":"Du bist dabei, ein neues Thema zu erstellen und den ausgewählten Beitrag dorthin zu verschieben.","other":"Du bist dabei, ein neues Thema zu erstellen und die \u003cb\u003e{{count}}\u003c/b\u003e ausgewählten Beiträge dorthin zu verschieben."}},"merge_topic":{"title":"In ein vorhandenes Thema verschieben","action":"in ein vorhandenes Thema verschieben","error":"Beim Verschieben der Beiträge in das Thema ist ein Fehler aufgetreten.","instructions":{"one":"Bitte wähle das Thema, in welches du den Beitrag verschieben möchtest.","other":"Bitte wähle das Thema, in welches du die \u003cb\u003e{{count}}\u003c/b\u003e Beiträge verschieben möchtest."}},"change_owner":{"title":"Eigentümer der Beiträge ändern","action":"Eigentümer ändern","error":"Beim Ändern des Eigentümers der Beiträge ist ein Fehler aufgetreten.","label":"Neuer Eigentümer der Beiträge","placeholder":"Benutzername des neuen Eigentümers","instructions":{"one":"Bitte wähle den neuen Eigentümer für den Beitrag von \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Bitte wähle den neuen Eigentümer für {{count}} Beiträge von \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"Bitte beachte, dass alle Benachrichtigungen für diesen Beitrag nicht rückwirkend auf den neuen Benutzer übertragen werden.\u003cbr\u003eWarnung: Aktuell werden keine Daten, die mit dem Beitrag zusammenhängen an den neuen Benutzer übertragen. Mit Bedacht verwenden."},"multi_select":{"select":"auswählen","selected":"ausgewählt ({{count}})","select_replies":"samt Antworten auswählen","delete":"ausgewählte löschen","cancel":"Auswahlvorgang abbrechen","select_all":"alle auswählen","deselect_all":"keine auswählen","description":{"one":"Du hast \u003cb\u003e1\u003c/b\u003e Beitrag ausgewählt.","other":"Du hast \u003cb\u003e{{count}}\u003c/b\u003e Beiträge ausgewählt."}}},"post":{"reply":"Auf {{link}} von {{replyAvatar}} {{username}} antworten","reply_topic":"Auf {{link}} antworten","quote_reply":"Antwort zitieren","edit":"Bearbeite {{link}} von {{replyAvatar}} {{username}}","edit_reason":"Grund: ","post_number":"Beitrag {{number}}","in_reply_to":"als Antwort auf","last_edited_on":"Beitrag zuletzt bearbeitet am","reply_as_new_topic":"Mit Themenwechsel antworten","continue_discussion":"Fortsetzung der Diskussion von {{postLink}}:","follow_quote":"springe zum zitierten Beitrag","show_full":"Zeige ganzen Beitrag","show_hidden":"Versteckte Inhalte anzeigen.","deleted_by_author":{"one":"(Beitrag wurde vom Autor zurückgezogen und wird automatisch in %{count} Stunde gelöscht, sofern dieser Beitrag nicht gemeldet wird)","other":"(Beitrag wurde vom Autor zurückgezogen und wird automatisch in %{count} Stunden gelöscht, sofern dieser Beitrag nicht gemeldet wird)"},"expand_collapse":"erweitern/minimieren","gap":{"one":"ein ausgeblendeter Beitrag","other":"{{count}} ausgeblendete Beiträge"},"more_links":"{{count}} weitere...","unread":"Beitrag ist ungelesen","has_replies":{"one":"Antwort","other":"Antworten"},"errors":{"create":"Entschuldige, es gab einen Fehler beim Anlegen des Beitrags. Bitte versuche es noch einmal.","edit":"Entschuldige, es gab einen Fehler beim Bearbeiten des Beitrags. Bitte versuche es noch einmal.","upload":"Entschuldige, es gab einen Fehler beim Hochladen der Datei. Bitte versuche es noch einmal.","attachment_too_large":"Entschuldige, die Datei, die du hochladen wolltest, ist zu groß (Maximalgröße {{max_size_kb}} KB).","image_too_large":"Entschuldige, das Bild, das du hochladen wolltest, ist zu groß (Maximalgröße {{max_size_kb}} KB), bitte reduziere die Dateigröße und versuche es nochmal.","too_many_uploads":"Entschuldige, du darfst immer nur eine Datei hochladen.","upload_not_authorized":"Entschuldige, die Datei, die du hochladen wolltest, ist nicht erlaubt (erlaubte Endungen: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Entschuldige, neue Benutzer dürfen keine Bilder hochladen.","attachment_upload_not_allowed_for_new_user":"Entschuldige, neue Benutzer dürfen keine Dateien hochladen."},"abandon":{"confirm":"Möchtest du deinen Beitrag wirklich verwerfen?","no_value":"Nein, beibehalten","yes_value":"Ja, verwerfen"},"wiki":{"about":"dieser Beitrag ist ein Wiki; Neulinge können diesen bearbeiten"},"archetypes":{"save":"Speicheroptionen"},"controls":{"reply":"verfasse eine Antwort auf diesen Beitrag","like":"dieser Beitrag gefällt mir","has_liked":"dir gefällt dieser Beitrag","undo_like":"gefällt mir nicht mehr","edit":"diesen Beitrag bearbeiten","edit_anonymous":"Du musst angemeldet sein, um diesen Beitrag zu bearbeiten.","flag":"Diesen Beitrag den Moderatoren melden","delete":"diesen Beitrag löschen","undelete":"diesen Beitrag wiederherstellen","share":"Link zu diesem Beitrag teilen","more":"Mehr","delete_replies":{"confirm":{"one":"Willst du auch die direkte Antwort auf diesen Beitrag löschen?","other":"Willst du auch die {{count}} direkten Antworten auf diesen Beitrag löschen?"},"yes_value":"Ja, auch die Antworten löschen","no_value":"Nein, nur diesen Beitrag"},"admin":"Aktionen für Administratoren","wiki":"Beitrag in Wiki umwandeln","unwiki":"Wiki in Beitrag umwandeln"},"actions":{"flag":"Melden","defer_flags":{"one":"Meldung ignorieren","other":"Meldungen ignorieren"},"it_too":{"off_topic":"Melde es auch","spam":"Melde es auch","inappropriate":"Melde es auch","custom_flag":"Melde es auch","bookmark":"Setze auch ein Lesezeichen","like":"Gefällt mir auch","vote":"Stimme auch dafür"},"undo":{"off_topic":"Meldung widerrufen","spam":"Meldung widerrufen","inappropriate":"Meldung widerrufen","bookmark":"Lesezeichen entfernen","like":"Gefällt mir nicht mehr","vote":"Stimme widerrufen"},"people":{"off_topic":"{{icons}} haben das als „am Thema vorbei“ gemeldet","spam":"{{icons}} haben das als Spam gemeldet","inappropriate":"{{icons}} haben das als unangemessen gemeldet","notify_moderators":"{{icons}} haben das den Moderatoren gemeldet","notify_moderators_with_url":"{{icons}} \u003ca href='{{postUrl}}'\u003ehaben das den Moderatoren gemeldet\u003c/a\u003e","notify_user":"{{icons}} haben eine private Nachricht gesendet","notify_user_with_url":"{{icons}} haben eine  \u003ca href='{{postUrl}}'\u003eprivate Nachricht\u003c/a\u003e gesendet","bookmark":"{{icons}} haben das als Lesezeichen","like":"{{icons}} gefällt dieser Beitrag","vote":"{{icons}} haben dafür gestimmt"},"by_you":{"off_topic":"Du hast das als „am Thema vorbei“ gemeldet","spam":"Du hast das als Spam gemeldet","inappropriate":"Du hast das als Unangemessen gemeldet","notify_moderators":"Du hast dies den Moderatoren gemeldet","notify_user":"Du hast diesem Benutzer eine private Nachricht gesendet","bookmark":"Du hast bei diesem Beitrag ein Lesezeichen gesetzt","like":"Dir gefällt dieser Beitrag","vote":"Du hast für diesen Beitrag gestimmt"},"by_you_and_others":{"off_topic":{"one":"Du und eine weitere Person haben das als „am Thema vorbei“ gemeldet","other":"Du und {{count}} weitere Personen haben das als „am Thema vorbei“ gemeldet"},"spam":{"one":"Du und eine weitere Person haben das als Spam gemeldet","other":"Du und {{count}} weitere Personen haben das als Spam gemeldet"},"inappropriate":{"one":"Du und eine weitere Person haben das als Unangemessen gemeldet","other":"Du und {{count}} weitere Personen haben das als Unangemessen gemeldet"},"notify_moderators":{"one":"Du und eine weitere Person haben dies den Moderatoren gemeldet","other":"Du und {{count}} weitere Personen haben dies den Moderatoren gemeldet"},"notify_user":{"one":"Du und eine weitere Person haben diesem Benutzer eine private Nachricht gesendet","other":"Du und {{count}} weitere Personen haben diesem Benutzer eine private Nachricht gesendet"},"bookmark":{"one":"Du und eine weitere Person haben bei diesem Beitrag ein Lesezeichen gesetzt","other":"Du und {{count}} weitere Personen haben bei diesem Beitrag ein Lesezeichen gesetzt"},"like":{"one":"Dir und einer weiteren Person gefällt dieser Beitrag","other":"Dir und {{count}} weiteren Personen gefällt dieser Beitrag"},"vote":{"one":"Du und eine weitere Person haben für diesen Beitrag gestimmt","other":"Du und {{count}} weitere Personen haben für diesen Beitrag gestimmt"}},"by_others":{"off_topic":{"one":"Eine Person hat das als „am Thema vorbei“ gemeldet","other":"{{count}} Personen haben das als „am Thema vorbei“ gemeldet"},"spam":{"one":"Eine Person hat das als Spam gemeldet","other":"{{count}} Personen haben das als Spam gemeldet"},"inappropriate":{"one":"Eine Person hat das als Unangemessen gemeldet","other":"{{count}} Personen haben das als Unangemessen gemeldet"},"notify_moderators":{"one":"Eine Person hat dies den Moderatoren gemeldet","other":"{{count}} Personen haben dies den Moderatoren gemeldet"},"notify_user":{"one":"Eine Person hat diesem Benutzer eine private Nachricht gesendet","other":"{{count}} Personen haben diesem Benutzer eine private Nachricht gesendet"},"bookmark":{"one":"Eine Person hat bei diesem Beitrag ein Lesezeichen gesetzt","other":"{{count}} Personen haben bei diesem Beitrag ein Lesezeichen gesetzt"},"like":{"one":"Einer Person gefällt dieser Beitrag","other":"{{count}} Personen gefällt dieser Beitrag"},"vote":{"one":"Eine Person hat für diesen Beitrag gestimmt","other":"{{count}} Personen haben für diesen Beitrag gestimmt"}}},"edits":{"one":"1 Bearbeitung","other":"{{count}} Bearbeitungen","zero":"keine Bearbeitungen"},"delete":{"confirm":{"one":"Möchtest du wirklich diesen Beitrag löschen?","other":"Möchtest du wirklich all diese Beiträge löschen?"}},"revisions":{"controls":{"first":"Erste Überarbeitung","previous":"Vorherige Überarbeitung","next":"Nächste Überarbeitung","last":"Letzte Überarbeitung","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e vs. \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Zeige die Änderungen inline an","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Zeige die Änderungen nebeneinander an","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Zeige die Markdown Source diffs nebeneinander an","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Markdown"}},"details":{"edited_by":"Bearbeitet von"}}},"category":{"can":"kann\u0026hellip; ","none":"(keine Kategorie)","choose":"Kategorie auswählen\u0026hellip;","edit":"bearbeiten","edit_long":"Bearbeiten","view":"Zeige Themen dieser Kategorie","general":"Allgemeines","settings":"Einstellungen","delete":"Kategorie löschen","create":"Kategorie erstellen","save":"Kategorie speichern","creation_error":"Beim Erstellen der Kategorie ist ein Fehler aufgetreten.","save_error":"Beim Speichern der Kategorie ist ein Fehler aufgetreten.","name":"Name der Kategorie","description":"Beschreibung","topic":"Themenkategorie","logo":"Logo für Kategorie","background_image":"Hintergrundbild für Kategorie","badge_colors":"Plakettenfarben","background_color":"Hintergrundfarbe","foreground_color":"Vordergrundfarbe","name_placeholder":"Ein oder maximal zwei Wörter","color_placeholder":"Irgendeine Web-Farbe","delete_confirm":"Möchtest du wirklich diese Kategorie löschen?","delete_error":"Beim Löschen der Kategorie ist ein Fehler aufgetreten.","list":"Kategorien auflisten","no_description":"Bitte füge eine Beschreibung für diese Kategorie hinzu.","change_in_category_topic":"Beschreibung bearbeiten","already_used":"Diese Farbe wird bereits für eine andere Kategorie verwendet","security":"Sicherheit","images":"Bilder","auto_close_label":"Themen automatisch schließen nach:","auto_close_units":"Stunden","email_in":"Benutzerdefinierte Adresse für eingehende E-Mails:","email_in_allow_strangers":"Akzeptiere E-Mails von nicht registrierten, anonymen Benutzern","email_in_disabled":"Das Erstellen von neuen Themen per E-Mail ist in den Website-Einstellungen deaktiviert. Um das Erstellen von neuen Themen per E-Mail zu erlauben,","email_in_disabled_click":"aktiviere die Einstellung „email in“.","allow_badges_label":"Erlaube das Verleihen von Abzeichen in dieser Kategorie","edit_permissions":"Berechtigungen bearbeiten","add_permission":"Berechtigung hinzufügen","this_year":"dieses Jahr","position":"Position","default_position":"Standardposition","position_disabled":"Kategorien werden in der Reihenfolge der Aktivität angezeigt. Um die Reihenfolge von Kategorien in Listen zu steuern,","position_disabled_click":"aktiviere die Einstellung „fixed category positions“.","parent":"Übergeordnete Kategorie","notifications":{"watching":{"title":"Beobachten","description":"Du wirst in diesen Kategorien automatisch alle neuen Themen beobachten. Du wirst über alle neuen Beiträge und Themen benachrichtigt werden. Außerdem wird die Anzahl der ungelesenen und neuen Beiträge neben dem Eintrag in der Themenliste angezeigt."},"tracking":{"title":"Verfolgen","description":"Du wirst in diesen Kategorien automatisch allen neuen Themen folgen. Die Anzahl der ungelesenen und neuen Beiträge wird neben dem Eintrag in der Themenliste angezeigt."},"regular":{"title":"Normal","description":"Du wirst nur dann benachrichtigt, wenn jemand deinen @Namen erwähnt oder auf deinen Beitrag antwortet."},"muted":{"title":"Stummgeschaltet","description":"Du erhältst keine Benachrichtigungen über neue Themen in diesen Kategorien und sie werden nicht in deiner Liste ungelesener Themen aufscheinen."}}},"flagging":{"title":"Aus welchem Grund meldest du diesen Beitrag?","action":"Beitrag melden","take_action":"Reagieren","notify_action":"Private Nachricht","delete_spammer":"Spammer löschen","delete_confirm":"Du wirst \u003cb\u003e%{posts}\u003c/b\u003e Beiträge und \u003cb\u003e%{topics}\u003c/b\u003e Themen von diesem Benutzer löschen, sein Konto entfernen, seine IP-Adresse \u003cb\u003e%{ip_address}\u003c/b\u003e für Neuanmeldungen sperren und die E-Mail-Adresse \u003cb\u003e%{ip_address}\u003c/b\u003e auf eine permanente Sperrliste setzen. Bist du dir sicher, dass dieser Benutzer wirklich ein Spammer ist?","yes_delete_spammer":"Ja, lösche den Spammer","submit_tooltip":"Private Meldung abschicken","take_action_tooltip":"Den Meldungsschwellenwert sofort erreichen, anstatt auf weitere Meldungen aus der Community zu warten.","cant":"Entschuldige, Du kannst diesen Beitrag augenblicklich nicht melden.","custom_placeholder_notify_user":"Weshalb erfordert der Beitrag, dass du den Benutzer direkt und privat kontaktieren möchtest? Sei spezifisch, konstruktiv und immer freundlich.","custom_placeholder_notify_moderators":"Warum soll ein Moderator sich diesen Beitrag ansehen? Bitte lass uns wissen, was genau Dich beunruhigt, und wenn möglich dafür relevante Links.","custom_message":{"at_least":"gib mindestens {{n}} Zeichen ein","more":"{{n}} weitere...","left":"{{n}} übrig"}},"flagging_topic":{"title":"Warum meldest du dieses Thema vertraulich?","action":"Thema melden","notify_action":"Private Nachricht"},"topic_map":{"title":"Zusammenfassung des Themas","links_shown":"zeige alle {{totalLinks}} Links...","clicks":{"one":"1 Klick","other":"%{count} Klicks"}},"topic_statuses":{"locked":{"help":"Dieses Thema ist geschlossen; Antworten sind nicht mehr möglich"},"unpinned":{"title":"Losgelöst","help":"Dieses Thema ist losgelöst; es wird in der normalen Reihenfolge angezeigt"},"pinned_globally":{"title":"Global angeheftet","help":"Dieses Thema ist global angeheftet; es wird immer am Anfang aller Listen auftauchen"},"pinned":{"title":"Angeheftet","help":"Dieses Thema ist angeheftet; es wird immer am Anfang seiner Kategorie auftauchen"},"archived":{"help":"Dieses Thema ist archiviert; es ist eingefroren und kann nicht mehr geändert werden"},"invisible":{"help":"Dieses Thema ist unsichtbar; es wird in keiner Themenliste angezeigt und kann nur noch mittels direktem Link betrachtet werden"}},"posts":"Beiträge","posts_lowercase":"Beiträge","posts_long":"dieses Thema enthält {{number}} Beiträge","original_post":"Original-Beitrag","views":"Aufrufe","views_lowercase":"Aufrufe","replies":"Antworten","views_long":"dieses Thema wurde {{number}} mal betrachtet","activity":"Aktivität","likes":"Likes","likes_lowercase":"Likes","likes_long":"es gibt {{number}} Likes in diesem Thema","users":"Benutzer","users_lowercase":"Benutzer","category_title":"Kategorie","history":"Verlauf","changed_by":"von {{author}}","categories_list":"Liste der Kategorien","filters":{"with_topics":"%{filter}e Themen","with_category":"%{filter}e Themen in %{category}","latest":{"title":"Aktuell","help":"die zuletzt geänderten Themen"},"hot":{"title":"Beliebt","help":"eine Auswahl der beliebtesten Themen"},"starred":{"title":"Favorisiert","help":"Themen, die du als Favoriten markiert hast"},"read":{"title":"Gelesen","help":"Themen, die du gelesen hast; werden in der Reihenfolge angezeigt, in der du diese gelesen hast"},"categories":{"title":"Kategorien","title_in":"Kategorie - {{categoryName}}","help":"alle Themen, gruppiert nach Kategorie"},"unread":{"title":{"zero":"Ungelesen","one":"Ungelesen (1)","other":"Ungelesen ({{count}})"},"help":"Themen mit ungelesenen Beiträgen, die du derzeit beobachtest oder verfolgst","lower_title_with_count":{"one":"1 ungelesenes","other":"{{count}} ungelesene"}},"new":{"lower_title_with_count":{"one":"1 neues","other":"{{count}} neue"},"lower_title":"neu","title":{"zero":"Neu","one":"Neu (1)","other":"Neu ({{count}})"},"help":"Themen, die in den letzten paar Tagen erstellt wurden"},"posted":{"title":"Meine Beiträge","help":"Themen zu denen du beigetragen hast"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"aktuelle Themen in der Kategorie {{categoryName}}"},"top":{"title":"Angesagt","help":"die aktivsten Themen in diesem Jahr, in diesem Monat, in dieser Woche und heute","yearly":{"title":"Angesagt jährlich"},"monthly":{"title":"Angesagt monatlich"},"weekly":{"title":"Angesagt wöchentlich"},"daily":{"title":"Angesagt täglich"},"this_year":"Dieses Jahr","this_month":"Dieses Monat","this_week":"Diese Woche","today":"Heute","other_periods":"zeige weitere angesagte Themen"}},"browser_update":"\u003ca href=\"http://www.discourse.org/faq/#browser\"\u003eDein Webbrowser ist leider zu alt, um dieses Forum zu besuchen\u003c/a\u003e. Bitte \u003ca href=\"http://browsehappy.com\"\u003einstalliere einen neueren Browser\u003c/a\u003e.","permission_types":{"full":"Erstellen / Antworten / Anschauen","create_post":"Antworten / Anschauen","readonly":"Anschauen"},"poll":{"voteCount":{"one":"1 Stimme","other":"%{count} Stimmen"},"results":{"show":"Ergebnisse anzeigen","hide":"Ergebnisse ausblenden"},"close_poll":"Umfrage beenden","open_poll":"Umfrage starten"},"type_to_filter":"zum Filtern hier eingeben...","admin":{"title":"Discourse-Administrator","moderator":"Moderator","dashboard":{"title":"Übersicht","last_updated":"Übersicht zuletzt aktualisiert:","version":"Version","up_to_date":"Du verwendest die neueste Version!","critical_available":"Ein kritisches Update ist verfügbar.","updates_available":"Updates sind verfügbar.","please_upgrade":"Bitte Upgrade durchführen!","no_check_performed":"Es wurde nicht nach Updates gesucht. Bitte stelle sicher, dass sidekiq läuft.","stale_data":"Es wurde schon länger nicht nach Updates gesucht. Bitte stelle sicher, dass sidekiq läuft.","version_check_pending":"Sieht so aus, als hättest du vor Kurzem aktualisiert. Großartig!","installed_version":"Installiert","latest_version":"Neueste","problems_found":"Es gibt Probleme mit deiner Discourse-Installation:","last_checked":"Zuletzt geprüft","refresh_problems":"Aktualisieren","no_problems":"Es wurden keine Probleme gefunden.","moderators":"Moderatoren:","admins":"Administratoren:","blocked":"Blockiert:","suspended":"Gesperrt:","private_messages_short":"PNs","private_messages_title":"Private Nachrichten","reports":{"today":"heute","yesterday":"gestern","last_7_days":"letzten 7 Tage","last_30_days":"letzten 30 Tage","all_time":"gesamt","7_days_ago":"vor 7 Tagen","30_days_ago":"vor 30 Tagen","all":"alle","view_table":"Als Tabelle anzeigen","view_chart":"Als Balkendiagramm anzeigen"}},"commits":{"latest_changes":"Letzte Änderungen: bitte häufig updaten!","by":"von"},"flags":{"title":"Meldungen","old":"Alt","active":"Aktiv","agree":"Zustimmen","agree_title":"Meldung bestätigen, weil diese gültig und richtig ist","agree_flag_modal_title":"Zustimmen und...","agree_flag_hide_post":"Zustimmen (Beitrag ausblenden + PN senden)","agree_flag_hide_post_title":"Diesen Beitrag ausblenden und den Benutzer mit einer automatisch gesendeten, privaten Nachricht zum Bearbeiten des Beitrags auffordern.","agree_flag":"Meldung zustimmen","agree_flag_title":"Der Meldung zustimmen und den Beitrag unverändert lassen.","defer_flag":"Ignorieren","defer_flag_title":"Entferne diese Meldung. Derzeit besteht kein Handlungsbedarf.","delete":"Löschen","delete_title":"Lösche den Beitrag, auf den diese Meldung verweist.","delete_post_defer_flag":"Beitrag löschen und Meldung ignorieren","delete_post_defer_flag_title":"Beitrag löschen; das Thema löschen, wenn es sich um den ersten Beitrag handelt","delete_post_agree_flag":"Beitrag löschen und der Meldung zustimmen","delete_post_agree_flag_title":"Beitrag löschen; das Thema löschen, wenn es sich um den ersten Beitrag handelt","delete_flag_modal_title":"Löschen und...","delete_spammer":"Spammer löschen","delete_spammer_title":"Lösche den Benutzer und alle seine Beiträge und Themen.","disagree_flag_unhide_post":"Ablehnen (Beitrag einblenden)","disagree_flag_unhide_post_title":"Verwerfe alle Meldungen über diesen Beitrag und blende den Beitrag wieder ein","disagree_flag":"Ablehnen","disagree_flag_title":"Meldung ablehnen, weil diese ungültig oder falsch ist","clear_topic_flags":"Erledigt","clear_topic_flags_title":"Das Thema wurde untersucht und Probleme wurden beseitigt. Klicke auf „Erledigt“, um die Meldungen zu entfernen.","more":"(weitere Antworten...)","dispositions":{"agreed":"zugestimmt","disagreed":"abgelehnt","deferred":"ignoriert"},"flagged_by":"Gemeldet von","resolved_by":"Geklärt durch","took_action":"Reagiert","system":"System","error":"Etwas ist schief gelaufen","reply_message":"Antworten","no_results":"Es gibt keine Meldungen.","topic_flagged":"Dieses \u003cstrong\u003eThema\u003c/strong\u003e wurde gemeldet.","visit_topic":"Besuche das Thema, um zu reagieren","was_edited":"Beitrag wurde nach der ersten Meldung bearbeitet","summary":{"action_type_3":{"one":"„am Thema vorbei“","other":"„am Thema vorbei“ x{{count}}"},"action_type_4":{"one":"unangemessen","other":"unangemessen x{{count}}"},"action_type_6":{"one":"benutzerdefiniert","other":"benutzerdefiniert x{{count}}"},"action_type_7":{"one":"benutzerdefiniert","other":"benutzerdefiniert x{{count}}"},"action_type_8":{"one":"Spam","other":"Spam x{{count}}"}}},"groups":{"primary":"Hauptgruppe","no_primary":"(keine Hauptgruppe)","title":"Gruppen","edit":"Gruppen bearbeiten","refresh":"Aktualisieren","new":"Neu","selector_placeholder":"Benutzer hinzufügen","name_placeholder":"Gruppenname, keine Leerzeichen, gleiche Regel wie beim Benutzernamen","about":"Hier kannst du Gruppenzugehörigkeiten und Gruppennamen bearbeiten.","group_members":"Gruppenmitglieder","delete":"Löschen","delete_confirm":"Diese Gruppe löschen?","delete_failed":"Gruppe konnte nicht gelöscht werden. Wenn dies eine automatische Gruppe ist, kann sie nicht gelöscht werden."},"api":{"generate_master":"Master API Key erzeugen","none":"Es gibt momentan keine aktiven API-Keys","user":"Benutzer","title":"API","key":"API-Key","generate":"Erzeugen","regenerate":"Erneuern","revoke":"Widerrufen","confirm_regen":"Möchtest du wirklich den API Key mit einem neuen ersetzen?","confirm_revoke":"Möchtest du wirklich den API Key widerrufen?","info_html":"Dein API-Key erlaubt dir das Erstellen und Bearbeiten von Themen via JSON-Aufrufen.","all_users":"Alle Benutzer","note_html":"Halte diesen Schlüssel \u003cstrong\u003egeheim\u003c/strong\u003e. Alle Benutzer, die diesen Schlüssel besitzen, können beliebige Beiträge als jeder Benutzer erstellen."},"backups":{"title":"Backups","menu":{"backups":"Backups","logs":"Logs"},"none":"Kein Backup verfügbar.","read_only":{"enable":{"title":"Nur-Lesen-Modus aktivieren","text":"Nur-Lesen-Modus aktivieren","confirm":"Möchtest du wirklich den Nur-Lesen Modus aktivieren?"},"disable":{"title":"Nur-Lesen-Modus deaktivieren","text":"Nur-Lesen-Modus deaktivieren"}},"logs":{"none":"Noch keine Protokolleinträge verfügbar..."},"columns":{"filename":"Dateiname","size":"Größe"},"upload":{"text":"Hochladen","uploading":"wird hochgeladen","success":"'{{filename}}' wurde erfolgreich hochgeladen.","error":"Beim Hochladen der Datei '{{filename}}' ist ein Fehler aufgetreten: {{message}}"},"operations":{"is_running":"Ein Vorgang läuft gerade...","failed":"Der Vorgang '{{operation}}' ist fehlgeschlagen. Bitte überprüfe die Logs.","cancel":{"text":"Abbrechen","title":"Den aktuellen Vorgang abbrechen","confirm":"Möchtest du wirklich den aktuellen Vorgang abbrechen?"},"backup":{"text":"Backup","title":"Ein Backup erstellen","confirm":"Willst du ein neues Backup starten?","without_uploads":"Ja (ohne Upload)"},"download":{"text":"Download","title":"Backup herunterladen"},"destroy":{"text":"Löschen","title":"Das Backup löschen","confirm":"Möchtest du wirklich das Backup löschen?"},"restore":{"is_disabled":"Wiederherstellung ist in den Website-Einstellungen deaktiviert.","text":"Wiederherstellen","title":"Das Backup wiederherstellen","confirm":"Möchtest du wirklich dieses Backup wiederherstellen?"},"rollback":{"text":"Zurücksetzen","title":"Die Datenbank auf den letzten funktionierenden Zustand zurücksetzen","confirm":"Möchtest du wirklich die Datenbank auf den letzten funktionierenden Stand zurücksetzen?"}}},"export_csv":{"users":{"text":"Exportieren","title":"Exportiere eine Benutzerliste als CSV-Datei."},"success":"Der Export wurde gestartet. Du wirst in Kürze über den Fortschritt benachrichtigt.","failed":"Der Export ist fehlgeschlagen. Bitte überprüfe die Logs."},"customize":{"title":"Anpassen","long_title":"Website-Anpassungen","header":"Kopfbereich","css":"Stylesheet","mobile_header":"Kopfbereich für Mobilgeräte","mobile_css":"Stylesheet Mobilgeräte","override_default":"Das Standard-Stylesheet nicht verwenden","enabled":"Aktiviert?","preview":"Vorschau","undo_preview":"Vorschau entfernen","rescue_preview":"Standard-Style","explain_preview":"Zeige die Website mit benutzerdefiniertem Stylesheet an","explain_undo_preview":"Gehe zurück zum aktuell aktivierten, benutzerdefinierten Stylesheet","explain_rescue_preview":"Zeige die Website mit dem Standard-Stylesheet an","save":"Speichern","new":"Neu","new_style":"Neuer Style","delete":"Löschen","delete_confirm":"Diese Anpassung löschen?","about":"Ändere die Stylesheets (CSS) und den HTML-Header auf der Website. Füge eine Anpassung hinzu, um zu starten.","color":"Farbe","opacity":"Transparenz","copy":"Kopieren","css_html":{"title":"CSS/HTML","long_title":"CSS und HTML Anpassungen"},"colors":{"title":"Farben","long_title":"Farbschemata","about":"Farbschemen erlauben dir die auf der Seite benutzen Farben zu ändern ohne CSS schreiben zu müssen. Füge ein Schema hinzu, um zu beginnen.","new_name":"Neues Farbschema","copy_name_prefix":"Kopie von","delete_confirm":"Dieses Farbschema löschen?","undo":"rückgängig","undo_title":"Die seit dem letzten Speichern an dieser Farbe vorgenommenen Änderungen rückgängig machen.","revert":"verwerfen","revert_title":"Diese Farbe auf das Discourse-Standard-Farbschema zurücksetzen.","primary":{"name":"erste","description":"Die meisten Texte, Bilder und Ränder."},"secondary":{"name":"zweite","description":"Die Haupthintergrundfarbe und Textfarbe einiger Schaltflächen."},"tertiary":{"name":"dritte","description":"Links, einige Schaltflächen, Benachrichtigungen und Akzentfarben."},"quaternary":{"name":"vierte","description":"Navigations-Links"},"header_background":{"name":"Hintergrund Kopfbereich","description":"Hintergrundfarbe des Kopfbereichs der Website."},"header_primary":{"name":"primärer Kopfbereich","description":"Text und Symbole im Kopfbereich der Website."},"highlight":{"name":"hervorheben","description":"Die Hintergrundfarbe der hervorgehobenen Elemente auf der Seite, so wie Beiträge und Themen."},"danger":{"name":"Gefahr","description":"Hervorhebungsfarbe für Aktionen wie Löschen von Beiträgen und Themen."},"success":{"name":"Erfolg","description":"Zeigt an, dass eine Aktion erfolgreich war."},"love":{"name":"Liebe","description":"Die Farbe des Like-Buttons."}}},"email":{"title":"E-Mail","settings":"Einstellungen","all":"Alle","sending_test":"Versende Test-E-Mail...","test_error":"Es gab ein Problem beim Senden der Test-E-Mail. Bitte überprüfe nochmals deine E-Mail-Einstellungen, stelle sicher dass dein Anbieter keine E-Mail-Verbindungen blockiert und probiere es erneut.","sent":"Gesendet","skipped":"Übersprungen","sent_at":"Gesendet am","time":"Zeit","user":"Benutzer","email_type":"E-Mail-Typ","to_address":"Empfänger","test_email_address":"E-Mail-Adresse für Test","send_test":"Test-E-Mail senden","sent_test":"Gesendet!","delivery_method":"Versandmethode","preview_digest":"Vorschau auf Neuigkeiten anzeigen","preview_digest_desc":"Hiermit kannst du dir anschauen, wie die regelmäßig versendeten Neuigkeits-Mails aussehen.","refresh":"Aktualisieren","format":"Format","html":"HTML","text":"Text","last_seen_user":"Letzter Benutzer:","reply_key":"Antwort-Schlüssel","skipped_reason":"Grund des Überspringens","logs":{"none":"Keine Protokolleinträge gefunden.","filters":{"title":"Filter","user_placeholder":"Benutzername","address_placeholder":"name@example.com","type_placeholder":"zusammenfassen, registrieren...","skipped_reason_placeholder":"Grund"}}},"logs":{"title":"Logs","action":"Aktion","created_at":"Erstellt","last_match_at":"Letzter Treffer","match_count":"Treffer","ip_address":"IP","delete":"Löschen","edit":"Bearbeiten","save":"Speichern","screened_actions":{"block":"blockieren","do_nothing":"nichts tun"},"staff_actions":{"title":"Mitarbeiter-Aktionen","instructions":"Klicke auf die Benutzernamen und Aktionen, um die Liste zu filtern. Klicke auf Avatare, um die Benutzerseiten zu sehen.","clear_filters":"Alles anzeigen","staff_user":"Mitarbeiter","target_user":"Betroffener Benutzer","subject":"Objekt","when":"Wann","context":"Kontext","details":"Details","previous_value":"Alt","new_value":"Neu","diff":"Vergleich","show":"Anzeigen","modal_title":"Details","no_previous":"Es gibt keinen vorherigen Wert.","deleted":"Kein neuer Wert. Der Eintrag wurde gelöscht.","actions":{"delete_user":"Benutzer löschen","change_trust_level":"Vertrauensstufe ändern","change_site_setting":"Website-Einstellungen ändern","change_site_customization":"Website-Anpassungen ändern","delete_site_customization":"Website-Anpassungen löschen","suspend_user":"Benutzer sperren","unsuspend_user":"Benutzer entsperren","grant_badge":"Abzeichen verleihen","revoke_badge":"Abzeichen entziehen"}},"screened_emails":{"title":"Überprüfte E-Mails","description":"Wenn jemand ein Konto erstellt, werden die folgenden E-Mail-Adressen überprüft und es wird die Anmeldung blockiert oder eine andere Aktion ausgeführt.","email":"E-Mail-Adresse","actions":{"allow":"Erlauben"}},"screened_urls":{"title":"Überprüfte URLs","description":"Die aufgelisteten URLs wurden in Beiträgen verwendet, die von Spammen erstellt wurden.","url":"URL","domain":"Domain"},"screened_ips":{"title":"Überprüfte IPs","description":"IP-Adressen die beobachtet werden. Benutze „Erlauben“, um IP-Adressen auf die Whitelist zu setzen.","delete_confirm":"Möchtest du wirklich die Regel für %{ip_address} entfernen?","actions":{"block":"Blockieren","do_nothing":"Erlauben"},"form":{"label":"Neu:","ip_address":"IP-Adresse","add":"Hinzufügen"}},"logster":{"title":"Fehlerprotokolle"}},"impersonate":{"title":"Als Benutzer ausgeben","help":"Benutze dieses Werkzeug, um zur Fehlersuche in die Rolle eines anderen Benutzers zu schlüpfen. Du musst dich abmelden, wenn du fertig bist."},"users":{"title":"Benutzer","create":"Administrator hinzufügen","last_emailed":"Letzte E-Mail","not_found":"Entschuldige, dieser Benutzername existiert im System nicht.","active":"Aktiv","nav":{"new":"Neu","active":"Aktiv","pending":"Genehmigung","admins":"Administratoren","moderators":"Moderatoren","suspended":"Gesperrt","blocked":"Blockiert"},"approved":"Genehmigt?","approved_selected":{"one":"Benutzer genehmigen","other":"Benutzer genehmigen ({{count}})"},"reject_selected":{"one":"Benutzer ablehnen","other":"Benutzer ablehnen ({{count}})"},"titles":{"active":"Aktive Benutzer","new":"Neue Benutzer","pending":"Benutzer mit ausstehender Genehmigung","newuser":"Benutzer mit Vertrauensstufe 0 (Neuer Benutzer)","basic":"Benutzer mit Vertrauensstufe 1 (Neulinge)","regular":"Benutzer mit Vertrauensstufe 2 (Stammgast)","leader":"Benutzer mit Vertrauensstufe 3 (Veteran)","elder":"Benutzer mit Vertrauensstufe 4 (Ältester)","admins":"Administratoren","moderators":"Moderatoren","blocked":"Blockierte Benutzer","suspended":"Gesperrte Benutzer"},"reject_successful":{"one":"Erfolgreich 1 Benutzer abgelehnt.","other":"Erfolgreich %{count} Benutzer abgelehnt."},"reject_failures":{"one":"Konnte 1 Benutzer nicht ablehnen.","other":"Konnte %{count} Benutzer nicht ablehnen."},"not_verified":"Nicht überprüft"},"user":{"suspend_failed":"Beim Sperren dieses Benutzers ist etwas schief gegangen {{error}}","unsuspend_failed":"Beim Entsperren dieses Benutzers ist etwas schief gegangen {{error}}","suspend_duration":"Wie lange soll dieser Benutzer gesperrt werden?","suspend_duration_units":"(Tage)","suspend_reason_label":"Warum sperrst du? Dieser Text ist auf der Profilseite des Benutzers \u003cb\u003efür jeden sichtbar\u003c/b\u003e und wird dem Benutzer angezeigt, wenn sich dieser anmelden will. Bitte kurz halten.","suspend_reason":"Grund","suspended_by":"Gesperrt von","delete_all_posts":"Lösche alle Beiträge","delete_all_posts_confirm":"Du wirst %{posts} Beiträge und %{topics} Themen löschen. Bist du dir sicher?","suspend":"Sperren","unsuspend":"Entsperren","suspended":"Gesperrt?","moderator":"Moderator?","admin":"Administrator?","blocked":"Geblockt?","show_admin_profile":"Administration","edit_title":"Titel bearbeiten","save_title":"Titel speichern","refresh_browsers":"Aktualisierung im Browser erzwingen","refresh_browsers_message":"Nachricht wurde an alle Clients gesendet!","show_public_profile":"Zeige öffentliches Profil","impersonate":"Nutzersicht","ip_lookup":"IP-Abfrage","log_out":"Abmelden","logged_out":"Der Benutzer wurde auf allen Geräten abgemeldet","revoke_admin":"Administrationsrechte entziehen","grant_admin":"Administrationsrechte vergeben","revoke_moderation":"Moderationsrechte entziehen","grant_moderation":"Moderationsrechte vergeben","unblock":"Blockierung aufheben","block":"Blockieren","reputation":"Reputation","permissions":"Berechtigungen","activity":"Aktivität","like_count":"Abgegebene / erhaltene Likes","last_100_days":"in den letzten 100 Tagen","private_topics_count":"Private Themen","posts_read_count":"Gelesene Beiträge","post_count":"Erstelle Beiträge","topics_entered":"Betrachtete Themen","flags_given_count":"Gemachte Meldungen","flags_received_count":"Erhaltene Meldungen","flags_given_received_count":"Erhaltene / gemachte Meldungen","approve":"Genehmigen","approved_by":"genehmigt von","approve_success":"Benutzer wurde genehmigt und eine E-Mail mit Anweisungen zur Aktivierung wurde gesendet.","approve_bulk_success":"Erfolgreich! Alle ausgewählten Benutzer wurden genehmigt und benachrichtigt.","time_read":"Lesezeit","delete":"Benutzer löschen","delete_forbidden_because_staff":"Administratoren und Moderatoren können nicht gelöscht werden.","delete_forbidden":{"one":"Benutzer können nicht gelöscht werden, wenn diese Beiträge haben. Lösche zuerst all dessen Beiträge, bevor du versuchst einen Benutzer zu löschen. (Beiträge, die älter als %{count} Tag sind, können nicht gelöscht werden.)","other":"Benutzer können nicht gelöscht werden, wenn diese Beiträge haben. Lösche zuerst all dessen Beiträge, bevor du versuchst einen Benutzer zu löschen. (Beiträge, die älter als %{count} Tage sind, können nicht gelöscht werden.)"},"cant_delete_all_posts":{"one":"Nicht alle Beiträge können gelöscht werden. Einige Beiträge sind älter als %{count} Tag (die „delete_user_max_post_age“ Einstellung).","other":"Nicht alle Beiträge können gelöscht werden. Einige Beiträge sind älter als %{count} Tage (die „delete_user_max_post_age“ Einstellung)."},"cant_delete_all_too_many_posts":{"one":"Nicht alle Beiträge konnten gelöscht werden, da der Benutzer mehr als 1 Beitrag hat (die „delete_all_posts_max“ Einstellung).","other":"Nicht alle Beiträge konnten gelöscht werden, da der Benutzer mehr als %{count} Beiträge hat (die „delete_all_posts_max“ Einstellung)."},"delete_confirm":"Bist du dir SICHER, dass du diesen Benutzer löschen willst? Dies kann nicht rückgängig gemacht werden!","delete_and_block":"Löschen und diese E-Mail-Adresse und IP-Adresse \u003cb\u003eblockieren\u003c/b\u003e","delete_dont_block":"Nur löschen","deleted":"Der Benutzer wurde gelöscht.","delete_failed":"Beim Löschen des Benutzers ist ein Fehler aufgetreten. Stelle sicher, dass dieser Benutzer keine Beiträge mehr hat.","send_activation_email":"Aktivierungsmail senden","activation_email_sent":"Die Aktivierungsmail wurde gesendet.","send_activation_email_failed":"Beim Senden der Aktivierungsmail ist ein Fehler aufgetreten. %{error}","activate":"Benutzer aktivieren","activate_failed":"Beim Aktivieren des Benutzers ist ein Fehler aufgetreten.","deactivate_account":"Benutzer deaktivieren","deactivate_failed":"Beim Deaktivieren des Benutzers ist ein Fehler aufgetreten.","unblock_failed":"Beim Aufheben der Blockierung des Benutzers ist ein Fehler aufgetreten.","block_failed":"Beim Blocken des Benutzers ist ein Fehler aufgetreten.","deactivate_explanation":"Ein deaktivierter Benutzer muss seine E-Mail-Adresse erneut bestätigen.","suspended_explanation":"Ein gesperrter Benutzer kann sich nicht einloggen.","block_explanation":"Ein geblockter Benutzer kann keine Themen erstellen oder Beiträge veröffentlichen.","trust_level_change_failed":"Beim Wechsel der Vertrauensstufe ist ein Fehler aufgetreten.","suspend_modal_title":"Benutzer sperren","trust_level_2_users":"Benutzer mit Vertrauensstufe 2","trust_level_3_requirements":"Anforderungen für Vertrauensstufe 3","tl3_requirements":{"title":"Anforderungen für Vertrauensstufe 3","table_title":"In den letzten 100 Tagen:","value_heading":"Wert","requirement_heading":"Anforderung","visits":"Aufrufe","days":"Tage","topics_replied_to":"Auf Themen geantwortet","topics_viewed":"Betrachtete Themen","topics_viewed_all_time":"Betrachtete Themen (gesamte Zeit)","posts_read":"Gelesene Beiträge","posts_read_all_time":"Gelesene Beiträge (gesamte Zeit)","flagged_posts":"Gemeldete Beiträge","flagged_by_users":"Von Benutzern gemeldet","likes_given":"Abgegebene Likes","likes_received":"Erhaltene Likes","qualifies":"Erfüllt die Anforderungen für Vertrauensstufe 3.","will_be_promoted":"Wird innerhalb der nächsten 24 Stunden befördert.","does_not_qualify":"Erfüllt nicht die Anforderungen für Vertrauensstufe 3."},"sso":{"title":"Single Sign-on","external_id":"Externe ID","external_username":"Benutzername","external_name":"Name","external_email":"E-Mail","external_avatar_url":"Avatar URL"}},"site_content":{"none":"Wähle einen Inhaltstyp, um mit dem Bearbeiten zu beginnen.","title":"Inhalt","edit":"Website-Inhalte bearbeiten"},"site_settings":{"show_overriden":"Zeige nur geänderte Einstellungen","title":"Einstellungen","reset":"zurücksetzen","none":"keine","no_results":"Keine Ergebnisse gefunden.","clear_filter":"Filter zurücksetzen","categories":{"all_results":"Alle","required":"Erforderlich","basic":"Grundeinstellungen","users":"Benutzer","posting":"Beiträge","email":"E-Mail","files":"Dateien","trust":"Vertrauensstufen","security":"Sicherheit","onebox":"Onebox","seo":"SEO","spam":"Spam","rate_limits":"Begrenzungen","developer":"Entwickler","embedding":"Einbettung","legal":"Rechtliches","uncategorized":"Sonstiges","backups":"Backups","login":"Anmeldung"}},"badges":{"title":"Abzeichen","new_badge":"Neues Abzeichen","new":"Neu","name":"Name","badge":"Abzeichen","display_name":"Anzeigename","description":"Beschreibung","badge_type":"Abzeichentyp","badge_grouping":"Gruppe","badge_groupings":{"modal_title":"Abzeichen-Gruppierungen"},"granted_by":"Verliehen von","granted_at":"Verliehen am","save":"Speichern","delete":"Löschen","delete_confirm":"Möchtest du wirklich dieses Abzeichen löschen?","revoke":"Entziehen","revoke_confirm":"Möchtest du wirklich dieses Abzeichen entziehen?","edit_badges":"Abzeichen bearbeiten","grant_badge":"Abzeichen verleihen","granted_badges":"Verliehene Abzeichen","grant":"Verleihen","no_user_badges":"%{name} wurden keine Abzeichen verliehen.","no_badges":"Es gibt keine Abzeichen die verliehen werden können.","allow_title":"Abzeichen darf als Titel verwendet werden","multiple_grant":"Kann mehrfach verliehen werden","listable":"Zeige Abzeichen auf der öffentlichen Abzeichenseite an","enabled":"Abzeichen aktivieren","icon":"Symbol","query":"Abfrage für Abzeichen (SQL)","target_posts":"Abfrage betrifft Beiträge","auto_revoke":"Führe die Abfrage zum Widerruf täglich aus","show_posts":"Den für die Verleihung des Abzeichens verantwortlichen Beitrag auf der Abzeichenseite anzeigen","trigger":"Auslöser","trigger_type":{"none":"Täglich aktualisieren","post_action":"Wenn ein Benutzer auf einen Beitrag reagiert","post_revision":"Wenn ein Benutzer einen Beitrag bearbeitet oder erstellt","trust_level_change":"Wenn sich die Vertrauensstufe eines Benutzers ändert","user_change":"Wenn ein Benutzer bearbeitet oder angelegt wird"},"preview":{"bad_count_warning":{"header":"WARNUNG!"},"sample":"Beispiel:","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e für Beitrag in %{link}","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e für Beitrag in %{link} um \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e um \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}}},"lightbox":{"download":"herunterladen"},"keyboard_shortcuts_help":{"title":"Tastenkombinationen","jump_to":{"title":"Springe zu","home":"\u003cb\u003eG\u003c/b\u003e, \u003cb\u003eH\u003c/b\u003e Hauptseite (Aktuell)","latest":"\u003cb\u003eG\u003c/b\u003e, \u003cb\u003eL\u003c/b\u003e Aktuell","new":"\u003cb\u003eG\u003c/b\u003e, \u003cb\u003eN\u003c/b\u003e Neu","unread":"\u003cb\u003eG\u003c/b\u003e, \u003cb\u003eU\u003c/b\u003e Ungelesen","starred":"\u003cb\u003eG\u003c/b\u003e, \u003cb\u003eF\u003c/b\u003e Favorisiert","categories":"\u003cb\u003eG\u003c/b\u003e, \u003cb\u003eC\u003c/b\u003e Kategorien"},"navigation":{"title":"Navigation","jump":"\u003cb\u003e#\u003c/b\u003e Springe zu Beitrag Nr.","back":"\u003cb\u003eU\u003c/b\u003e Zurück","up_down":"\u003cb\u003eK\u003c/b\u003e / \u003cb\u003eJ\u003c/b\u003e Auswahl nach oben/unten bewegen","open":"\u003cb\u003eO\u003c/b\u003e oder \u003cb\u003e↵ Eingabe\u003c/b\u003e Ausgewähltes Thema anzeigen","next_prev":"\u003cb\u003e⇧ Umsch\u003c/b\u003e + \u003cb\u003eJ\u003c/b\u003e / \u003cb\u003e⇧ Umsch\u003c/b\u003e + \u003cb\u003eK\u003c/b\u003e Nächster/vorheriger Abschnitt"},"application":{"title":"Anwendung","create":"\u003cb\u003eC\u003c/b\u003e Neues Thema erstellen","notifications":"\u003cb\u003eN\u003c/b\u003e Benachrichtigungen anzeigen","site_map_menu":"\u003cb\u003e=\u003c/b\u003e Sitemap-Menü öffnen","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e Profil-Menü öffnen","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e Zeige neue/geänderte Themen","search":"\u003cb\u003e/\u003c/b\u003e Suchen","help":"\u003cb\u003e?\u003c/b\u003e Hilfe zu Tastenkombinationen anzeigen","dismiss_new_posts":"\u003cb\u003eX\u003c/b\u003e, \u003cb\u003eR\u003c/b\u003e Neue Themen / Beiträge ignorieren","dismiss_topics":"\u003cb\u003eX\u003c/b\u003e, \u003cb\u003eT\u003c/b\u003e Themen ignorieren"},"actions":{"title":"Aktionen","star":"\u003cb\u003eF\u003c/b\u003e Thema favorisieren","share_topic":"\u003cb\u003e⇧ Umsch\u003c/b\u003e + \u003cb\u003eS\u003c/b\u003e Thema teilen","share_post":"\u003cb\u003eS\u003c/b\u003e Beitrag teilen","reply_as_new_topic":"\u003cb\u003eT\u003c/b\u003e Mit Themenwechsel antworten","reply_topic":"\u003cb\u003e⇧ Umsch\u003c/b\u003e + \u003cb\u003eR\u003c/b\u003e Auf Thema antworten","reply_post":"\u003cb\u003eR\u003c/b\u003e Auf Beitrag antworten","quote_post":"\u003cb\u003eQ\u003c/b\u003e Beitrag zitieren","like":"\u003cb\u003eL\u003c/b\u003e Beitrag gefällt mir","flag":"\u003cb\u003e!\u003c/b\u003e Beitrag melden","bookmark":"\u003cb\u003eB\u003c/b\u003e Lesezeichen auf Beitrag setzen","edit":"\u003cb\u003eE\u003c/b\u003e Beitrag bearbeiten","delete":"\u003cb\u003eD\u003c/b\u003e Beitrag löschen","mark_muted":"\u003cb\u003eM\u003c/b\u003e, \u003cb\u003eM\u003c/b\u003e Thema stummschalten","mark_regular":"\u003cb\u003eM\u003c/b\u003e, \u003cb\u003eR\u003c/b\u003e Thema auf Normal setzen","mark_tracking":"\u003cb\u003eM\u003c/b\u003e, \u003cb\u003eT\u003c/b\u003e Thema verfolgen","mark_watching":"\u003cb\u003eM\u003c/b\u003e, \u003cb\u003eW\u003c/b\u003e Thema beobachten"}},"badges":{"title":"Abzeichen","allow_title":"Abzeichen als Titel erlauben?","multiple_grant":"wird mehrfach verliehen?","badge_count":{"one":"1 Abzeichen","other":"%{count} Abzeichen"},"more_badges":{"one":"+1 mehr","other":"+%{count} mehr"},"granted":{"one":"1 mal verliehen","other":"%{count} mal verliehen"},"select_badge_for_title":"Wähle ein Abzeichen als deinen Titel aus","no_title":"\u003ckeine Titel\u003e","badge_grouping":{"getting_started":{"name":"Erste Schritte"},"community":{"name":"Community"},"trust_level":{"name":"Vertrauensstufe"},"other":{"name":"Andere"},"posting":{"name":"Beiträge"}},"badge":{"editor":{"name":"Bearbeiter","description":"Hat einen Beitrag bearbeitet"},"basic_user":{"name":"Neuling","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/4\"\u003eErmöglicht\u003c/a\u003e das Nutzen alle wesentlichen Community-Funktionen"},"regular_user":{"name":"Stammgast","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/5\"\u003eErmöglicht\u003c/a\u003e das Versenden von Einladungen"},"leader":{"name":"Veteran","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/6\"\u003eErmöglicht\u003c/a\u003e das Verschieben und Umbenennen von Themen, das Veröffentlichen von \u003ca href=\"http://de.wikipedia.org/wiki/Nofollow\"\u003everfolgbaren Links\u003c/a\u003e und den Zugang zur Lounge"},"elder":{"name":"Ältester","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/7\"\u003eErmöglicht\u003c/a\u003e das Bearbeiten aller Beiträge und das Anheften, Schließen, Archivieren, Aufteilen und Zusammenfügen von Themen"},"welcome":{"name":"Willkommen","description":"Hat ein Like erhalten"},"autobiographer":{"name":"Autobiograf","description":"Hat \u003ca href=\"/my/preferences\"\u003eBenutzerprofil\u003c/a\u003e ausgefüllt"},"nice_post":{"name":"Netter Beitrag","description":"Hat 10 Likes für einen Beitrag erhalten. Dieses Abzeichen kann mehrfach verliehen werden."},"good_post":{"name":"Guter Beitrag","description":"Hat 25 Likes für einen Beitrag erhalten. Dieses Abzeichen kann mehrfach verliehen werden."},"great_post":{"name":"Großartiger Beitrag","description":"Hat 50 Likes für einen Beitrag erhalten. Dieses Abzeichen kann mehrfach verliehen werden."},"first_like":{"name":"Erster Like","description":"Hat Gefallen an einem Beitrag gefunden"},"first_flag":{"name":"Erste Meldung","description":"Hat einen Beitrag gemeldet"},"first_share":{"name":"Erster geteilter Beitrag","description":"Hat einen Beitrag geteilt"},"first_link":{"name":"Erster Link","description":"Hat einen internen Link auf einen anderen Beitrag hinzugefügt"},"first_quote":{"name":"Erstes Zitat","description":"Hat einen Benutzer zitiert"},"read_guidelines":{"name":"Richtlinien gelesen","description":"Hat die \u003ca href=\"/guidelines\"\u003eCommunity-Richtlinien\u003c/a\u003e gelesen"},"reader":{"name":"Leser","description":"Hat in einem Thema mit mehr als 100 Beiträgen jeden Beitrag gelesen"}}}}}};
I18n.locale = 'de';
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
// locale : german (de)
// author : lluchs : https://github.com/lluchs
// author: Menelion Elensúle: https://github.com/Oire

(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define(['moment'], factory); // AMD
    } else if (typeof exports === 'object') {
        module.exports = factory(require('../moment')); // Node
    } else {
        factory(window.moment); // Browser global
    }
}(function (moment) {
    function processRelativeTime(number, withoutSuffix, key, isFuture) {
        var format = {
            'm': ['eine Minute', 'einer Minute'],
            'h': ['eine Stunde', 'einer Stunde'],
            'd': ['ein Tag', 'einem Tag'],
            'dd': [number + ' Tage', number + ' Tagen'],
            'M': ['ein Monat', 'einem Monat'],
            'MM': [number + ' Monate', number + ' Monaten'],
            'y': ['ein Jahr', 'einem Jahr'],
            'yy': [number + ' Jahre', number + ' Jahren']
        };
        return withoutSuffix ? format[key][0] : format[key][1];
    }

    return moment.defineLocale('de', {
        months : "Januar_Februar_März_April_Mai_Juni_Juli_August_September_Oktober_November_Dezember".split("_"),
        monthsShort : "Jan._Febr._Mrz._Apr._Mai_Jun._Jul._Aug._Sept._Okt._Nov._Dez.".split("_"),
        weekdays : "Sonntag_Montag_Dienstag_Mittwoch_Donnerstag_Freitag_Samstag".split("_"),
        weekdaysShort : "So._Mo._Di._Mi._Do._Fr._Sa.".split("_"),
        weekdaysMin : "So_Mo_Di_Mi_Do_Fr_Sa".split("_"),
        longDateFormat : {
            LT: "HH:mm [Uhr]",
            L : "DD.MM.YYYY",
            LL : "D. MMMM YYYY",
            LLL : "D. MMMM YYYY LT",
            LLLL : "dddd, D. MMMM YYYY LT"
        },
        calendar : {
            sameDay: "[Heute um] LT",
            sameElse: "L",
            nextDay: '[Morgen um] LT',
            nextWeek: 'dddd [um] LT',
            lastDay: '[Gestern um] LT',
            lastWeek: '[letzten] dddd [um] LT'
        },
        relativeTime : {
            future : "in %s",
            past : "vor %s",
            s : "ein paar Sekunden",
            m : processRelativeTime,
            mm : "%d Minuten",
            h : processRelativeTime,
            hh : "%d Stunden",
            d : processRelativeTime,
            dd : processRelativeTime,
            M : processRelativeTime,
            MM : processRelativeTime,
            y : processRelativeTime,
            yy : processRelativeTime
        },
        ordinal : '%d.',
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });
}));

moment.fn.shortDateNoYear = function(){ return this.format('TT. MMM'); };
moment.fn.shortDate = function(){ return this.format('TT. MMM JJJJ'); };
moment.fn.longDate = function(){ return this.format('TT. MMMM JJJJ, H:mm'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
