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
MessageFormat.locale.da = function ( n ) {
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
r += "There ";
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
r += "er <a href='/unread'>1 ulæst</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "er <a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " ulæste</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["da"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "og ";
return r;
},
"false" : function(d){
var r = "";
r += "er ";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='/new'>1 ny</a> topic";
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
r += "og ";
return r;
},
"false" : function(d){
var r = "";
r += "er ";
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
})() + " nye</a> topics";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["da"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " tilbage, eller ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "se andre emner i ";
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
r += "Dette emne har ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 indlæg";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " indlæg";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["da"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "with a high like to post ratio";
return r;
},
"med" : function(d){
var r = "";
r += "with a very high like to post ratio";
return r;
},
"high" : function(d){
var r = "";
r += "with an extremely high like to post ratio";
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
}});I18n.translations = {"da":{"js":{"number":{"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}}},"dates":{"time":"h:mm a","long_no_year":"MMM D h:mm a","long_no_year_no_time":"MMM D","long_with_year":"MMM D, YYYY h:mm a","long_with_year_no_time":"MMM D, YYYY","long_date_with_year":"MMM D, 'YY LT","long_date_without_year":"MMM D, LT","long_date_with_year_without_time":"MMM D, 'YY","long_date_without_year_with_linebreak":"MMM D \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"MMM D, 'YY \u003cbr/\u003eLT","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c 1s","other":"\u003c %{count}s"},"x_seconds":{"one":"1s","other":"%{count}s"},"less_than_x_minutes":{"one":"\u003c 1m","other":"\u003c %{count}m"},"x_minutes":{"one":"1m","other":"%{count}m"},"about_x_hours":{"one":"1t","other":"%{count}t"},"x_days":{"one":"1d","other":"%{count}d"},"about_x_years":{"one":"1å","other":"%{count}å"},"over_x_years":{"one":"\u003e 1å","other":"\u003e %{count}å"},"almost_x_years":{"one":"1å","other":"%{count}å"},"date_month":"MMM D","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"1 min","other":"%{count} min"},"x_hours":{"one":"1 time","other":"%{count} timer"},"x_days":{"one":"1 dag","other":"%{count} dage"},"date_year":"MMM D, 'YY"},"medium_with_ago":{"x_minutes":{"one":"1 min siden","other":"%{count} min siden"},"x_hours":{"one":"1 time siden","other":"%{count} timer siden"},"x_days":{"one":"1 dag siden","other":"%{count} dage siden"}}},"share":{"topic":"del et link til dette emne","post":"del et link til dette indlæg","close":"luk","twitter":"del dette link på Twitter","facebook":"del dette link på Facebook","google+":"del dette link på Google+","email":"send dette link i en e-mail"},"edit":"redigér titel og kategori for dette emne","not_implemented":"Beklager, denne feature er ikke blevet implementeret endnu.","no_value":"Nej","yes_value":"Ja","generic_error":"Beklager, der opstod en fejl.","generic_error_with_reason":"Der opstod en fejl: %{error}","sign_up":"Tilmeld dig","log_in":"Log ind","age":"Alder","joined":"Tilmeldt","admin_title":"Admin","flags_title":"Flag","show_more":"vis mere","links":"Links","links_lowercase":"links","faq":"FAQ","guidelines":"Retningslinier","privacy_policy":"Privatlivspolitik","privacy":"Privatliv","terms_of_service":"Betingelser","mobile_view":"Mobil-visning","desktop_view":"Desktop-visning","you":"Dig","or":"eller","now":"lige nu","read_more":"læs mere","more":"Mere","less":"Mindre","never":"aldrig","daily":"dagligt","weekly":"ugentligt","every_two_weeks":"hver anden uge","max":"maksimum","character_count":{"one":"{{count}} tegn","other":"{{count}} tegn"},"in_n_seconds":{"one":"på 1 sekund","other":"på {{count}} sekunder"},"in_n_minutes":{"one":"på 1 minut","other":"på {{count}} minutter"},"in_n_hours":{"one":"på 1 time","other":"på {{count}} timer"},"in_n_days":{"one":"på 1 dag","other":"på {{count}} dage"},"suggested_topics":{"title":"Foreslåede emner"},"about":{"simple_title":"Om","title":"Om %{title}","stats":"Site statistik","our_admins":"Vores Administratorer","our_moderators":"Vores Moderatorer","stat":{"all_time":"Alt","last_7_days":"De sidste 7 Dage"},"like_count":"Likes","topic_count":"Emner","post_count":"Indlæg","user_count":"Brugere"},"bookmarks":{"not_logged_in":"Beklager, du skal været logget ind for at bogmærke indlæg","created":"Du har bogmærket dette indlæg.","not_bookmarked":"Du har læst dette indlæg; klik for at bogmærke det","last_read":"Dette er det seneste indlæg, du har læst; klik for at bogmærke det","remove":"Fjern bogmærke"},"topic_count_latest":{"one":"{{count}} nyt eller opdateret emne.","other":"{{count}} nye eller opdaterede emner."},"topic_count_unread":{"one":"{{count}} ulæst emne.","other":"{{count}} ulæste emner."},"topic_count_new":{"one":"{{count}} nyt indlæg","other":"{{count}} nye indlæg."},"click_to_show":"Klik for at se.","preview":"forhåndsvising","cancel":"annullér","save":"Gem ændringer","saving":"Gemmer…","saved":"Gemt!","upload":"Upload","uploading":"Uploader…","uploaded":"Uploadet!","enable":"Aktiver","disable":"Deaktiver","undo":"Fortryd","revert":"Gendan","failed":"Fejlet","banner":{"close":"Afvis denne banner."},"choose_topic":{"none_found":"Ingen emner fundet.","title":{"search":"Søg efter et emne efter navn, url eller UD:","placeholder":"indtast emnets titel her"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e oprettede \u003ca href='{{topicUrl}}'\u003eemnet\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eDu\u003c/a\u003e oprettede \u003ca href='{{topicUrl}}'\u003eemnet\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e svarede på \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eDu\u003c/a\u003e svarede på \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e svarede på \u003ca href='{{topicUrl}}'\u003eemnet\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eDu\u003c/a\u003e svarede på \u003ca href='{{topicUrl}}'\u003eemnet\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e nævnte \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e nævnte \u003ca href='{{user2Url}}'\u003edig\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eDu\u003c/a\u003e nævnte \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Oprettet af \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Oprettet af \u003ca href='{{userUrl}}'\u003edig\u003c/a\u003e","sent_by_user":"Sendt af \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Sendt af \u003ca href='{{userUrl}}'\u003edig\u003c/a\u003e"},"groups":{"visible":"Gruppen er synlige for alle brugere","title":{"one":"gruppe","other":"grupper"},"members":"Medlemmer","posts":"Indlæg","alias_levels":{"title":"Hvem kan bruge denne gruppe som et alias?","nobody":"Ingen","only_admins":"Kun administratore","mods_and_admins":"Kun moderatore og administratore","members_mods_and_admins":"Kun gruppe medlemmer, moderatore og administratore","everyone":"Alle"}},"user_action_groups":{"1":"Likes givet","2":"Likes modtaget","3":"Bogmærker","4":"Emner","5":"Indlæg","6":"Svar","7":"Referencer","9":"Citater","10":"Favoritter","11":"Ændringer","12":"Sendte indlæg","13":"Indbakke"},"categories":{"all":"alle kategorier","all_subcategories":"Alle","no_subcategory":"ingen","category":"Kategori","posts":"Indlæg","topics":"Emner","latest":"Seneste","latest_by":"seneste af","toggle_ordering":"vis/skjul rækkefølgeskifter","subcategories":"Underkategorier:","topic_stats":"Antallet af nye emner.","topic_stat_sentence":{"one":"%{count} nyt emne i den/det seneste %{unit}.","other":"%{count} nye emner i den/det seneste %{unit}."},"post_stats":"Antallet af nye indlæg.","post_stat_sentence":{"one":"%{count} nyt indlæg i den seneste %{unit}.","other":"%{count} nye indlæg i den seneste %{unit}."}},"ip_lookup":{"title":"IP-adresse opslag","hostname":"Værtsnavn","location":"Sted","location_not_found":"(ukendt)","organisation":"Organisation","phone":"Telefon","other_accounts":"Andre kontoer med denne IP adresse","no_other_accounts":"(ingen)"},"user":{"said":"{{username}} sagde:","profile":"Profil","mute":"Mute","edit":"Redigér indstillinger","download_archive":"download arkiv med alle mine indlæg","private_message":"Private beskeder","private_messages":"Beskeder","activity_stream":"Aktivitet","preferences":"Indstillinger","bookmarks":"Bogmærker","bio":"Om mig","invited_by":"Inviteret af","trust_level":"Tillidsniveau","notifications":"Underretninger","disable_jump_reply":"Spring ikke til dit nye indlæg efter du har svaret","dynamic_favicon":"Vis indkommende underretninger i favicon","edit_history_public":"Lad andre brugere se mine tidligere revisioner","external_links_in_new_tab":"Åbn alle eksterne links i en ny fane","enable_quoting":"Tillad citering af markeret tekst","change":"skift","moderator":"{{user}} er moderator","admin":"{{user}} er admin","moderator_tooltip":"Dette bruger er moderator","admin_tooltip":"Denne bruger er administrator","suspended_notice":"Denne bruger er suspenderet indtil {{date}}.","suspended_reason":"Begrundelse: ","mailing_list_mode":"Få en email, hver nyt emne (med mindre du har sat et emne eller en kategori på lydløs)","watched_categories":"Overvåget","watched_categories_instructions":"Du overvåger automatisk alle emner i disse kategorier","tracked_categories":"Fulgt","tracked_categories_instructions":"Du vil blive underrettet for hvert nyt indlæg i denne tråd. En optælling af nye indlæg vil blive vist ved siden af tråden.","muted_categories":"Ignoreret","muted_categories_instructions":"Du ignorerer automatisk alle emner i disse kategorier","delete_account":"Slet min konto","delete_account_confirm":"Er du sikker på du vil slette din konto permanent? Dette kan ikke fortrydes!","deleted_yourself":"Din konto er nu slettet.","delete_yourself_not_allowed":"Du kan ikke slette din konto lige nu. Kontakt en administrator for at få din konto slettet.","unread_message_count":"Beskeder","staff_counters":{"flags_given":"hjælpsomme markeringer givet","flagged_posts":"markerede indlæg","deleted_posts":"slettede indlæg","suspensions":"suspenderinger"},"messages":{"all":"Alle","mine":"Mine","unread":"Ulæste"},"change_password":{"success":"(e-mail sendt)","in_progress":"(sender e-mail)","error":"(fejl)","action":"Send e-mail til nulstilling af adgangskode","set_password":"Skriv password"},"change_about":{"title":"Skift “Om mig”"},"change_username":{"title":"Skift brugernavn","confirm":"Der kan være konsekvenser ved at skifte brugernavn. Er du sikker på at du vil skifte?","taken":"Beklager, det brugernavn er optaget.","error":"Der skete en fejl i forbindelse med skift af dit brugernavn.","invalid":"Det brugernavn er ugyldigt. Det må kun bestå af bogstaver og tal."},"change_email":{"title":"Skift e-mail-adresse","taken":"Beklager, den e-mail-adresse er optaget af en anden bruger.","error":"Der opstod en fejl i forbindelse med skift af din e-mail-adresse. Måske er adressen allerede i brug?","success":"Vi har sendt en e-mail til din nye adresse. Klik på linket i mail’en for at aktivere din nye e-mail-adresse."},"change_avatar":{"title":"Skift dit profil billede","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, baseret på","refresh_gravatar_title":"Gendindlæs dit profil billede","letter_based":"System genereret profil billede","uploaded_avatar":"Brugerdefineret profil billede","uploaded_avatar_empty":"Tilføj et brugerdefineret profil billede","upload_title":"Upload dit profil billede","upload_picture":"Upload et billede","image_is_not_a_square":"Advarsel: vi har beskåret dit billede fordi det ikke er kvadratisk."},"change_profile_background":{"title":"Profil baggrundsbillede"},"email":{"title":"E-mail","instructions":"Vil aldrig blive vist offentligt.","ok":"Det ser fint ud. Vi e-mail’er dig for at bekræfte.","invalid":"Skriv venligst en gyldig e-mail-adresse.","authenticated":"Din e-mail er bekræftet af {{provider}}.","frequency":"Vi sender dig kun e-mail, hvis du ikke har været på siden for nylig, og du ikke allerede har set de ting vi ville e-mail’e dig om."},"name":{"title":"Navn","instructions":"Lang version af dit navn","too_short":"Dit navn er for kort.","ok":"Dit navn ser fint ud."},"username":{"title":"Brugernavn","instructions":"Skal være unikt, ingen mellemrum og kort","short_instructions":"Andre brugere kan referere til dig som @{{username}}.","available":"Brugernavnet er tilgængeligt.","global_match":"E-mail-adressen matcher det registrerede brugernavn.","global_mismatch":"Allerede registreret. Prøv {{suggestion}}?","not_available":"Ikke ledigt. Prøv {{suggestion}}?","too_short":"Dit brugernavn er for kort.","too_long":"Dit brugernavn er for langt.","checking":"Kontrollerer om brugernavnet er ledigt…","enter_email":"Brugernavn fundet. Skriv den tilhørende e-mail-adresse.","prefilled":"E-mail-adressen matcher det registrerede brugernavn."},"locale":{"title":"sprog","instructions":"Brugerinterface sprog. Det skifter når de reloader siden.","default":"(standard)"},"password_confirmation":{"title":"Gentag adgangskode"},"last_posted":"Sidste indlæg","last_emailed":"Sidste e-mail","last_seen":"Sidst set","created":"Oprettet","log_out":"Log ud","location":"Sted","website":"Site","email_settings":"E-mail","email_digests":{"title":"Send mig et e-mail-sammendrag af ny aktivitet når jeg ikke besøger sitet","daily":"dagligt","weekly":"ugenligt","bi_weekly":"hver anden uge"},"email_direct":"Modtag e-mail, når nogen citerer dig, svarer på dine indlæg eller nævner dit @brugernavn","email_private_messages":"Modtag e-mail, når nogen sender dig en privat besked","email_always":"Send email notifikationer, selvom jeg er aktiv på forummet","other_settings":"Andre","categories_settings":"Kategorier","new_topic_duration":{"label":"Betragt emner som nye når","not_viewed":"jeg ikke har set dem endnu","last_here":"oprettet siden du sidst var her","after_n_days":{"one":"Oprettet i dag","other":"oprettet indenfor de seneste {{count}} dage"},"after_n_weeks":{"one":"oprettet indenfor den seneste uge","other":"oprettet indenfor de sidste {{count}} uger"}},"auto_track_topics":"Følg automatisk emner jeg åbner","auto_track_options":{"never":"aldrig","always":"altid","after_n_seconds":{"one":"efter et sekund","other":"efter {{count}} sekunder"},"after_n_minutes":{"one":"efter et minut","other":"efter {{count}} minutter"}},"invited":{"search":"tast for at søge invitationer…","title":"Invitationer","user":"Inviteret bruger","none":"Du har ikke inviteret nogen endnu.","truncated":"Viser de første {{count}} invitationer.","redeemed":"Brugte invitationer","redeemed_at":"Invitation brugt","pending":"Udestående invitationer","topics_entered":"Emner åbnet","posts_read_count":"Indlæg læst","expired":"Denne invitation er forældet","rescind":"Fjern","rescinded":"Invitation fjernet","time_read":"Læsetid","days_visited":"Besøgsdage","account_age_days":"Kontoens alder i dage","create":"Send en invitation","bulk_invite":{"none":"Du har ikke inviteret nogen her endnu. Du kan sende individuelle invitationer eller invitere en masse mennesker på én gang ved at \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003euploade en samlet liste over invitationer\u003c/a\u003e.","text":"Masse invitering fra en fil","uploading":"UPLOADER","success":"Filen er uploadet uden problemer, du vil snart blive notificeret om hvordan det går.","error":"Der var en fejl ved upload af filen '{{filename}}': {{message}}"}},"password":{"title":"Adgangskode","too_short":"Din adgangskode er for kort.","common":"Den adgangskode er for udbredt.","ok":"Din adgangskode ser fin ud.","instructions":"Skal være på mindst %{count} tegn."},"ip_address":{"title":"Sidste IP-adresse"},"registration_ip_address":{"title":"Registrerings IP adresse"},"avatar":{"title":"Profil billede"},"title":{"title":"Titel"},"filters":{"all":"Alle"},"stream":{"posted_by":"Skrevet af","sent_by":"Sendt af","private_message":"privat besked","the_topic":"emnet"}},"loading":"Indlæser…","errors":{"prev_page":"da vi prøvede at indlæse","reasons":{"network":"Netværksfejl","server":"Server fejl","forbidden":"Adgang nægtet","unknown":"Fejl"},"desc":{"network":"Tjek din internetforbindelse.","network_fixed":"Det ser ud som om den er tilbage.","server":"Fejl kode: {{status}}","unknown":"Noget gik galt."},"buttons":{"back":"Gå tilbage","again":"Prøv igen","fixed":"Indlæs side"}},"close":"Luk","assets_changed_confirm":"Dette site er lige blevet opdateret. Vil du opdatere nu til den seneste version?","read_only_mode":{"enabled":"En administrator har aktiver \"kun læsnings\" tilstranden. Du kan fortsætte med at læse forummet, men nogle handlinger vil ikke fungere.","login_disabled":"Log in er deaktiveret midlertidigt, da forummet er i \"kun læsnings\" tilstand."},"too_few_topics_notice":"Opret mindst 5 offentlige emner og %{posts} offentlige indlæg for at starte diskussionerne. Nye brugere vil ikke kunne opnå tillidsniveauer medmindre der er indhold som de kan læse. Denne meddelelse fremgår kun for staff.","learn_more":"Læs mere…","year":"år","year_desc":"Indlæg oprettet i de seneste 365 dage","month":"måned","month_desc":"Indlæg oprettet i de seneste 30 dage","week":"uge","week_desc":"Indlæg oprettet i de seneste 7 dage","day":"dag","first_post":"Første indlæg","mute":"Mute","unmute":"Unmute","last_post":"Sidste indlæg","last_post_lowercase":"Sidste indlæg","summary":{"enabled_description":"Du ser et sammendrag af dette emne: kun de mest interessante indlæg som andre finder interresante.","description":"Der er \u003cb\u003e{{count}}\u003c/b\u003e svar.","description_time":"Der er \u003cb\u003e{{count}}\u003c/b\u003e svar og det vil tage ca. \u003cb\u003e{{readingTime}} minutter\u003c/b\u003e at læse.","enable":"Opsummér dette emne","disable":"Vis alle indlæg"},"deleted_filter":{"enabled_description":"Dette emne indeholder slettede indlæg, som er blevet skjult.","disabled_description":"Slettede indlæg bliver vist. ","enable":"Skjul Slettede Indlæg","disable":"Vis Slettede Indlæg"},"private_message_info":{"title":"Privat samtale","invite":"Invitér andre…","remove_allowed_user":"Ønsker du virkelig at fjerne {{name}} fra denne private samtale?"},"email":"E-mail","username":"Brugernavn","last_seen":"Sidst set","created":"Oprettet","created_lowercase":"Oprettet","trust_level":"Tillidsniveau","search_hint":"brugernavn eller email","create_account":{"title":"Opret konto","failed":"Noget gik galt. Måske er e-mail-adressen allerede registreret – prøv “Jeg har glemt min adgangskode”-linket"},"forgot_password":{"title":"Glemt adgangskode","action":"Jeg har glemt min adgangskode","invite":"Skriv brugernavn eller e-mail-adresse, så sender vi dig en mail så du kan nulstille din adgangskode.","reset":"Nulstil adgangskode","complete_username":"Hvis en konto matcher brugernavnet \u003cb\u003e%{username}\u003c/b\u003e, vil du om lidt modtage en email med instruktioner om hvordan man nulstiller passwordet.","complete_email":"Hvis en konto matcher \u003cb\u003e%{email}\u003c/b\u003e, vil du om lidt modtage en email med instruktioner om hvordan man nulstiller passwordet."},"login":{"title":"Log ind","username":"Bruger","password":"Adgangskode","email_placeholder":"e-mail eller brugernavn","caps_lock_warning":"Caps Lock er sat til","error":"Ukendt fejl","blank_username_or_password":"Skriv din email adresse eller brugernavn og dit password","reset_password":"Nulstil adgangskode","logging_in":"Logger ind...","or":"Eller","authenticating":"Logger ind…","awaiting_confirmation":"Din konto mangler at blive aktiveret. Brug “Jeg har glemt min adgangskode”-linket for at få en ny aktiverings-mail.","awaiting_approval":"Din konto er ikke blevet godkendt af en moderator endnu. Du får en e-mail når den bliver godkendt.","requires_invite":"Beklager, det kræve en invitation at blive medlem af dette forum.","not_activated":"Du kan ikke logge ind endnu. Vi har tidligere sendt en aktiverings-e-mail til dig på \u003cb\u003e{{sentTo}}\u003c/b\u003e. Følg venligst instruktionerne i den e-mail for at aktivere din konto.","resend_activation_email":"Klik her for at sende aktiverings-e-mail’en igen.","sent_activation_email_again":"Vi har sendt endnu en aktiverings-e-mail til dig på \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Det kan tage nogen få minutter før den når frem; kontrollér også din spam-mappe.","google":{"title":"med Google","message":"Logger ind med Google (kontrollér at pop-op-blokering ikke er aktiv)"},"google_oauth2":{"title":"med google","message":"Validering med Google (vær sikker på at pop up blokeringer er slået fra)"},"twitter":{"title":"med Twitter","message":"Logger ind med Twitter (kontrollér at pop-op-blokering ikke er aktiv)"},"facebook":{"title":"med Facebook","message":"Logger ind med Facebook (kontrollér at pop-op-blokering ikke er aktiv)"},"yahoo":{"title":"med Yahoo","message":"Logger ind med Yahoo (kontrollér at pop-op-blokering ikke er aktiv)"},"github":{"title":"med GitHub","message":"Logger ind med GitHub (kontrollér at pop-op-blokering ikke er aktiv)"}},"composer":{"posting_not_on_topic":"Hvilket emne vil du svare på?","saving_draft_tip":"gemmer","saved_draft_tip":"gemt","saved_local_draft_tip":"gemt lokalt","similar_topics":"Dit emne minder om…","drafts_offline":"kladder offline","min_length":{"need_more_for_title":"der mangler {{n}} tegn i titlen","need_more_for_reply":"der mangler {{n}} tegn i svaret"},"error":{"title_missing":"Titlen er påkrævet","title_too_short":"Titlen skal være på mindst {{min}} tegn","title_too_long":"Titlen skal være kortere end {{max}} tegn.","post_missing":"Indlægget kan ikke være tomt.","post_length":"Indlægget skal være på mindst {{min}} tegn.","category_missing":"Du skal vælge en kategori."},"save_edit":"Gem ændringer","reply_original":"Svar til det oprindelige emne","reply_here":"Svar her","reply":"Svar","cancel":"Annullér","create_topic":"Opret emne","create_pm":"Opret privat besked","title":"Eller tryk Ctrl+Enter","users_placeholder":"Tilføj bruger","title_placeholder":"Hvad handler diskussionen om i korte træk?","edit_reason_placeholder":"hvorfor redigerer du?","show_edit_reason":"(tilføj en begrundelse for ændringen)","reply_placeholder":"Skriv dit svar her. Brug Markdown eller BBCode til at formatere. Træk et billede ind for at uploade det.","view_new_post":"Se dit nye indlæg.","saving":"Gemmer…","saved":"Gemt!","saved_draft":"Du har en kladde i gang. vælg denne kasse for at forsætte med at redigere den.","uploading":"Uploader…","show_preview":"forhåndsvisning \u0026raquo;","hide_preview":"\u0026laquo; skjul forhåndsvisning","quote_post_title":"Citér hele indlægget","bold_title":"Fed","bold_text":"fed skrift","italic_title":"Kursiv","italic_text":"kursiv skrift","link_title":"Link","link_description":"skriv linkets beskrivelse her","link_dialog_title":"Indsæt link","link_optional_text":"evt. titel","quote_title":"Citatblok","quote_text":"Citatblok","code_title":"Præformateret tekst","code_text":"indryk præformateret tekst med 4 mellemrum","upload_title":"Billede","upload_description":"skriv billedets beskrivelse her","olist_title":"Nummereret liste","ulist_title":"Punktopstilling","list_item":"Listepunkt","heading_title":"Overskrift","heading_text":"Overskrift","hr_title":"Vandret streg","undo_title":"Fortryd","redo_title":"Gentag","help":"Hjælp til Markdown-redigering","toggler":"skjul eller vis editor-panelet","admin_options_title":"Valgfrie staff-indstillinger for dette emne","auto_close_label":"Tidspunkt for automatisk lukning af emne:","auto_close_units":"(antal timer, et tidspunkt eller et timestamp)","auto_close_examples":"indtast klokkeslet eller antal timer — 24, 17:00, 2013-11-22 14:00","auto_close_error":"Indtast venligst en gyldig værdi."},"notifications":{"title":"notifikation ved @navns nævnelse, svar til dine indlæg og emner, private beskeder, mv.","none":"Du har ikke nogen notifikationer lige nu.","more":"se ældre notifikationer","total_flagged":"total markerede indlæg","mentioned":"\u003ci title='nævnt' class='icon'\u003e@\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='citeret' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='svaret' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='svaret' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='redigeret' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","private_message":"\u003ci title='privat besked' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='privat besked' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='accepterede din invitation' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e accepted your invitation\u003c/p\u003e","moved_post":"\u003ci title='indlæg flyttet' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e moved {{description}}\u003c/p\u003e","linked":"\u003ci title='indlæg linket' class='fa fa-arrow-left'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='badge givet' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eDu blev tildelt '{{description}}'\u003c/p\u003e"},"upload_selector":{"title":"Indsæt billede","title_with_attachments":"Tilføj et billede eller en fil","from_my_computer":"Fra min computer","from_the_web":"Fra nettet","remote_tip":"skriv adressen på et billede i formen http://example.com/billede.jpg","remote_tip_with_attachments":"indtast adressen på et billede eller en fil på formen http://example.com/file.ext (tilladte filendelser: {{authorized_extensions}}).","local_tip":"klik for at vælge et billede fra din computer.","local_tip_with_attachments":"klik for at vælge et billede eller en fil fra din computer (tilladte filendelser: {{authorized_extensions}})","hint":"(du kan også trække og slippe ind i editoren for at uploade dem)","hint_for_supported_browsers":"(du kan også trække og slippe eller indsætte billeder ind i editoren for at uploade dem)","uploading":"Uploader billede","image_link":"link som dit billede vil pege på"},"search":{"title":"søg efter emner, indlæg, brugere eller kategorier","no_results":"Ingen resultater fundet.","searching":"Søger…","post_format":"#{{post_number}} af {{username}}","context":{"user":"Søg i indlæg fra @{{username}}","category":"Søg i kategorien \"{{category}}\"","topic":"Søg i dette emne"}},"site_map":"gå til en anden emneoversigt eller kategori","go_back":"gå tilbage","not_logged_in_user":"bruger side, med oversigt over aktivitet og indstillinger","current_user":"gå til brugerside","starred":{"title":"Favorit","help":{"star":"tilføj dette emne til din favorit-liste","unstar":"fjern dette emne fra din favorit-liste"}},"topics":{"bulk":{"reset_read":"Nulstil \"læst\"","delete":"Slet emner","dismiss_posts":"Afvis indlæg","dismiss_posts_tooltip":"Nulstil \"ulæste\" på disse emner, men fortsæt med at vise dem på min \"ulæste\" liste når der kommer nye indlæg","dismiss_topics":"Afvist Emner","dismiss_topics_tooltip":"Stop med at vide disse emner i min \"ulæste\" liste når der kommer nye indlæg","dismiss_new":"Afvis nye","toggle":"vælg flere emner af gangen","actions":"Handlinger på flere indlæg","change_category":"Skift kategori","close_topics":"Luk indlæg","notification_level":"Skift niveau for underetninger","selected":{"one":"Du har valgt \u003cb\u003e1\u003c/b\u003e indlæg.","other":"Du har valgt \u003cb\u003e{{count}}\u003c/b\u003e indlæg."}},"none":{"starred":"Du har ikke nogen favorit-emner endnu. For at gøre et emne til favorit, tryk på stjernen ved siden af emnets titel.","unread":"Du har ingen ulæste emner.","new":"Du har ingen nye emner.","read":"Du har ikke læst nogen emner endnu.","posted":"Du har ikke skrevet nogen indlæg endnu.","latest":"Der er ikke nogen nye emner. Det er sørgeligt.","hot":"Der er ingen populære emner.","category":"Der er ingen emner i kategorien {{category}}.","top":"Der er ingen top emner","educate":{"new":"\u003cp\u003eSom standard, bliver emmer betragtet som nye når de blev oprettet indenfor de sidste 2 dage.\u003c/p\u003e\u003cp\u003eDu kan ændre dette i dine \u003ca href=\"%{userPrefsUrl}\"\u003eindstillinger\u003c/a\u003e.\u003c/p\u003e","unread":"\u003cp\u003eSom standard vil der kun være indication for ulæste indlæg for emmer du har:\u003c/p\u003e\u003cul\u003e\u003cli\u003eOprettet\u003c/li\u003e\u003cli\u003eSvaret på\u003c/li\u003e\u003cli\u003eLæst i mere end 4 minutter\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eEller, hvis du specifikt har sat emnet til overvåget eller følger via notifikations indstillingen i bunden af hvert emne.\u003c/p\u003e\u003cp\u003eDu kan ændre dette i dine \u003ca href=\"%{userPrefsUrl}\"\u003eindstillinger\u003c/a\u003e.\u003c/p\u003e"}},"bottom":{"latest":"Der er ikke flere populære emner.","hot":"There are no more hot topics.","posted":"Der er ikke flere emner.","read":"Der er ikke flere læste emner.","new":"Der er ikke flere nye emner.","unread":"Der er ikke flere ulæste emner.","starred":"Der er ikke flere favorit-emner.","category":"Der er ikke flere emner i kategorien {{category}}.","top":"Der er ikke flere top emner"}},"topic":{"filter_to":"Vis {{post_count}} indlæg i emnet","create":"Opret emne","create_long":"Opret et nyt emne i debatten","private_message":"Start en privat samtale","list":"Emner","new":"nyt emne","unread":"ulæste","new_topics":{"one":"1 nyt emne","other":"{{count}} nye emner"},"unread_topics":{"one":"1 ulæst emne","other":"{{count}} ulæste emner"},"title":"Emne","loading_more":"Indlæser flere emner…","loading":"Indlæser emne…","invalid_access":{"title":"Emnet er privat","description":"Beklager, du har ikke adgang til dette emne!","login_required":"Do skal logge på for at se dette emne."},"server_error":{"title":"Emnet kunne ikke indlæses","description":"Beklager, vi kunne ikke indlæse det emne, muligvis grundet et problem med netværksforbindelsen. Prøv venligst igen. Hvis problemet fortæstter, så skriv venligst til os."},"not_found":{"title":"Emnet findes ikke","description":"Beklager, vi kunne ikke finde det emne i databasen. Måske er det blevet fjernet af moderator?"},"total_unread_posts":{"one":"der er {{count}} indlæg du ikke har læst i dette emne","other":"der er {{count}} indlæg du ikke har læst i dette emne"},"unread_posts":{"one":"der er 1 indlæg du ikke har læst i dette emne","other":"der er {{count}} indlæg du ikke har læst i dette emne"},"new_posts":{"one":"der er kommet 1 nyt indlæg i dette emne siden du læste det sidst","other":"der er kommet {{count}} nye indlæg i dette emne siden du læste det sidst"},"likes":{"one":"der er ét like i dette emne","other":"der er {{count}} likes i dette emne"},"back_to_list":"Tilbage til emneoversigt","options":"Emneindstillinger","show_links":"vis links i dette emne","toggle_information":"vis detaljer om emnet","read_more_in_category":"Mere læsestof? Se andre emner i {{catLink}} eller {{latestLink}}.","read_more":"Mere læsestof? {{catLink}} eller {{latestLink}}.","browse_all_categories":"Vis alle kategorier","view_latest_topics":"vis seneste emner","suggest_create_topic":"Hvorfor ikke oprette et emne?","jump_reply_up":"hop til tidligere svar","jump_reply_down":"hop til senere svar","deleted":"Emnet er blevet slettet","auto_close_notice":"Dette emne lukker automatisk %{timeLeft}.","auto_close_title":"Indstillinger for automatisk lukning","auto_close_save":"Gem","auto_close_remove":"Luk ikke dette emne automatisk","progress":{"title":"emnestatus","go_top":"top","go_bottom":"bund","go":"start","jump_bottom_with_number":"hop til indlæg %{post_number}","total":"antal indlæg","current":"nuværende indlæg","position":"indlæg %{current} af %{total}"},"notifications":{"reasons":{"3_6":"Du får notifikationer fordi du overvåger denne kategori.","3_5":"Du får notifikationer fordi du overvåger dette emne automatisk.","3_2":"Du får notifikationer fordi du overvåger dette emne.","3_1":"Du får notifikationer fordi du oprettede dette emne.","3":"Du får notifikationer fordi du overvåger dette emne.","2_8":"Du får notifikationer fordi du følger dette kategori.","2_4":"Du får notifikationer fordi du har besvaret dette emne.","2_2":"Du får notifikationer fordi du følger dette emne.","2":"Du får notifikationer fordi du \u003ca href=\"/users/{{username}}/preferences\"\u003ehar læst dette emne\u003c/a\u003e.","1_2":"Du får kun notifikationer hvis nogen nævner dit @navn eller svarer på dit indlæg.","1":"Du får kun notifikationer hvis nogen nævner dit @navn eller svarer på dit indlæg.","0_7":"Du ignorerer alle notifikationer i denne kategori.","0_2":"Du får ingen notifikationer for dette emne.","0":"Du får ingen notifikationer for dette emne."},"watching_pm":{"title":"Følger","description":"Du vil blive underrettet for hver ny post i denne private mail. Antallet af ulæste og nye posts vil også blive vist ved siden af emnelisten"},"watching":{"title":"Overvåger","description":"Du vil blive underrettet for hvert nyt indlæg i denne tråd. En optælling af nye indlæg vil blive vist ved siden af tråden."},"tracking_pm":{"title":"Følger","description":"Antallet af ulæste og nye indlæg, vil stå efter den private besked. Du bliver kun notificeret nogen nævner dit @name eller svarer på dit indlæg."},"tracking":{"title":"Følger","description":"Antallet af ulæste og nye indlæg vil stå efter emne linien. Du bliver kun notificeret hvis nogen nævner dit @name eller svarer på dine indlæg."},"regular":{"title":"Standard","description":"du får kun besked hvis nogen nævner dit @navn eller svarer på dit indlæg."},"regular_pm":{"title":"Standard","description":"Du får kun notifikationer hvis nogen nævner dit @navn eller svarer på dit indlæg i denne private besked."},"muted_pm":{"title":"Lydløs","description":"Du vil aldrig blive underrettet om noget omhandlende denne private mailboks"},"muted":{"title":"Stille!","description":"du får ikke besked om nogen hændelser i dette emne, og det vil ikke fremgå af din liste over ulæste emner."}},"actions":{"recover":"Gendan emne","delete":"Slet emne","open":"Åbn emne","close":"Luk emne","auto_close":"Luk automatisk","make_banner":"Banner emne","remove_banner":"Fjern banner emne","unpin":"Frigør emne","pin":"Fastgør emne","pin_globally":"Fastgør emnet globalt","unarchive":"Gendan emne fra arkiv","archive":"Arkivér emne","invisible":"Gør usynlig","visible":"Gør synlig","reset_read":"Glem hvilke emner jeg har læst","multi_select":"Vælg emner der skal flyttes"},"reply":{"title":"Svar","help":"begynd at skrive et svar til dette emne"},"clear_pin":{"title":"Fjern tegnestift","help":"Fjern tegnestiften på dette emne så det ikke længere vises i toppen af emnelisten"},"share":{"title":"Del","help":"del et link til dette emne"},"flag_topic":{"title":"Rapportér indlæg","help":"gør moderator opmærksom på dette indlæg","success_message":"Du har nu rapporteret dette emne til administrator."},"inviting":"Inviterer…","automatically_add_to_groups_optional":"Denne invitation giver også adgang til disse grupper: (valgfrit, kun for administrator)","automatically_add_to_groups_required":"Denne invitation giver også adgang til disse grupper: (\u003cb\u003ePåkrævet\u003c/b\u003e, kun for administrator)","invite_private":{"title":"Invitér til privat samtale","email_or_username":"Inviteret brugers e-mail eller brugernavn","email_or_username_placeholder":"e-mail-adresse eller brugernavn","action":"Invitér","success":"Vi har inviteret brugeren til at deltage i din private samtale.","error":"Beklager, der skete en fejl, da vi forsøgte at invitere brugeren.","group_name":"gruppe navn"},"invite_reply":{"title":"Invitér","action":"E-mail-invitation","help":"send invitationer til dine venner, så de kan svare på dette indlæg med et enkelt klik","to_topic":"Vi sender din ven en kort e-mail, som gør det muligt at svare på dette emne med et enkelt klik uden at skulle logge ind.","to_forum":"Vi sender din ven en kort e-mail, som gør det muligt at tilmelde sig øjeblikkeligt ved at klikke på et link, uden det er nødvendigt at logge ind.","email_placeholder":"e-mail-adresse","success":"Vi har sendt en invitation til \u003cb\u003e{{email}}\u003c/b\u003e. Vi påminder dig når invitationen er blevet accepteret. Check invitations-fanen på din brugerside, for at følge med i hvem du har inviteret.","error":"Beklager, vi kunne ikke invitere den person. Måske er de allerede brugere?"},"login_reply":"Log ind for at svare","filters":{"n_posts":{"one":"1 indlæg","other":"{{count}} indlæg"},"cancel":"Se alle indlæg i emnet."},"split_topic":{"title":"Flyt til nyt emne","action":"flyt til nyt emne","topic_name":"Navn på nyt emne","error":"Der opstod en fejl under flytningen af indlæg til det nye emne.","instructions":{"one":"Du er ved at oprette et nyt emne med det valgte indlæg.","other":"Du er ved at oprette et nyt emne med de \u003cb\u003e{{count}}\u003c/b\u003e valgte indlæg."}},"merge_topic":{"title":"Flyt til eksisterende emne","action":"flyt til eksisterende emne","error":"Der opstod en fejl under flytningen af indlæg til emnet.","instructions":{"one":"Vælg venligst det emne som indlægget skal flyttes til.","other":"Vælg venligst det emne som de  \u003cb\u003e{{count}}\u003c/b\u003e indlæg skal flyttes til."}},"change_owner":{"title":"Skift hvem der ejer emnet","action":"skift ejerskab","error":"Der opstod en fejl da ejerskabet skulle skiftes.","label":"Ny ejer af emner","placeholder":"brugernavn på ny ejer","instructions":{"one":"Vælg den nye ejer af indlægget, oprindeligt skrevet af \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Vælg den nye ejer af {{count}} indlæg, oprindeligt skrevet af \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"Bemærk at tidligere notifikationer på dette emne vil ikke blive overført til den nye bruger.\n\u003cbr\u003eAdvarsel: På nuværende tidspunkt, vil ingen data der er afhængig af dette indlæg blive overført til den nye bruger. Brug forsigtigt."},"multi_select":{"select":"vælg","selected":"valgt ({{count}})","select_replies":"vælg +svar","delete":"slet valgte","cancel":"glem valg","select_all":"marker alle","deselect_all":"marker ingen","description":{"one":"Du har valgt \u003cb\u003e1\u003c/b\u003e indlæg.","other":"Du har valgt \u003cb\u003e{{count}}\u003c/b\u003e indlæg."}}},"post":{"reply":"Svar til {{link}} af {{replyAvatar}} {{username}}","reply_topic":"Svar til {{link}}","quote_reply":"citér svar","edit":"Redigerer {{link}} af {{replyAvatar}} {{username}}","edit_reason":"Reason: ","post_number":"indlæg {{number}}","in_reply_to":"som svar til","last_edited_on":"indlæg sidst redigeret den","reply_as_new_topic":"Svar som nyt emne","continue_discussion":"Fortsætter debatten fra {{postLink}}:","follow_quote":"gå til det citerede indlæg","show_full":"Vis hele emnet","show_hidden":"Vist skjult indhold.","deleted_by_author":{"one":"(indlæg trukket tilbage af forfatteren, slettes automatisk om %{count} time med mindre det bliver flaget)","other":"(indlæg trukket tilbage af forfatteren, slettes automatisk om %{count} timer med mindre det bliver flaget)"},"expand_collapse":"fold ud/ind","gap":{"one":"1 indlæg udeladt","other":"{{count}} indlæg udeladt"},"more_links":"{{count}} endnu...","unread":"Indlæg er ulæst","has_replies":{"one":"Svar","other":"Svar"},"errors":{"create":"Beklager, der opstod en fejl under oprettelsen af dit indlæg. Prøv venligst igen.","edit":"Beklager, der opstrod en fejl under redigeringen af dit indlæg. Prøv venligst igen.","upload":"Beklager, der opstod en fejl ved upload af filen. Prøv venligst igen.","attachment_too_large":"Beklager, filen, som du forsøger at uploade, er for store (den maksimale størrelse er {{max_size_kb}}kb).","image_too_large":"Beklager, billedet, som du forsøger at uploade, er for stort (den maksimale størrelse er {{max_size_kb}}kb), gør det venligst mindre og prøv igen.","too_many_uploads":"Beklager, men du kan kun uploade én fil ad gangen.","upload_not_authorized":"Beklager, filen, som du forsøger at uploade, er ikke godkendt (godkendte filendelser: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Beklager, nye brugere kan ikke uploade billeder.","attachment_upload_not_allowed_for_new_user":"Beklager, nye brugere kan ikke uploade vedhæftede filer."},"abandon":{"confirm":"Er du sikker på, at du vil droppe dit indlæg?","no_value":"Nej","yes_value":"Ja"},"wiki":{"about":"dette indlæg er en wiki; almindelige brugere kan redigere den"},"archetypes":{"save":"Gem indstillinger"},"controls":{"reply":"begynd at skrive et svar på dette indlæg","like":"like dette indlæg","has_liked":"Du liker dette indlæg","undo_like":"fortryd like","edit":"redigér dette indlæg","edit_anonymous":"Beklager, du skal være logget ind for at redigere dette indlæg.","flag":"gør moderator opmærksom på dette indlæg","delete":"slet dette indlæg","undelete":"annullér sletning","share":"del et link til dette indlæg","more":"Mere","delete_replies":{"confirm":{"one":"Ønsker du også at slette svaret på dette indlæg?","other":"Ønsker du også at slette de {{count}} svar på dette indlæg?"},"yes_value":"Ja, slet også svarene","no_value":"Nej, kun dette indlæg"},"admin":"indlæg administrator handlinger","wiki":"Wiki indlæg","unwiki":"Af-Wiki indlæg"},"actions":{"flag":"Flag","defer_flags":{"one":"Udsæt markering","other":"Udsæt markeringer"},"it_too":{"off_topic":"Flag det også","spam":"Flag det også","inappropriate":"Flag det også","custom_flag":"Flag det også","bookmark":"Bogmærk det også","like":"Like det også","vote":"Stem på det også"},"undo":{"off_topic":"Undo flag","spam":"Undo flag","inappropriate":"Undo flag","bookmark":"Undo bookmark","like":"Undo like","vote":"Undo vote"},"people":{"off_topic":"{{icons}} markerede dette som urelevant for emnet","spam":"{{icons}} markerede dette som spam","inappropriate":"{{icons}} markerede dette som upassende","notify_moderators":"{{icons}} underrettede moderatorer","notify_moderators_with_url":"{{icons}} \u003ca href='{{postUrl}}'\u003eunderrettede moderatorer\u003c/a\u003e","notify_user":"{{icons}} sendte en privat besked","notify_user_with_url":"{{icons}} sendte en \u003ca href='{{postUrl}}'\u003eprivat besked\u003c/a\u003e","bookmark":"{{icons}} bogmærker","like":"{{icons}} likes","vote":"{{icons}} stemmer"},"by_you":{"off_topic":"Du flagede dette som off-topic","spam":"Du flagede dette som spam","inappropriate":"Du flagede dette som upassende","notify_moderators":"Du flagede dette til gennemsyn","notify_user":"Du sendte en privat besked til denne bruger","bookmark":"Du bogmærkede dette indlæg","like":"Du liker dette indlæg","vote":"Du stemte for dette indlæg"},"by_you_and_others":{"off_topic":{"one":"Du og 1 anden flagede dette som off-topic","other":"Du og {{count}} andre flagede dette som off-topic"},"spam":{"one":"Du og 1 anden flagede dette som spam","other":"Du og {{count}} andre flagede dette som spam"},"inappropriate":{"one":"Du og 1 anden flagede dettes om upasende","other":"Du og {{count}} andre flagede dettes om upasende"},"notify_moderators":{"one":"Du og 1 anden flagede dette til moderation","other":"Du og {{count}} andre flagede dette til moderation"},"notify_user":{"one":"Du og 1 anden sendte en privat besked til denne bruger","other":"Du og {{count}} andre sendte en privat besked til denne bruger"},"bookmark":{"one":"Du og 1 anden bogmærkede dette indlæg","other":"Du og {{count}} andre bogmærkede dette indlæg"},"like":{"one":"Du og 1 anden liker dette","other":"Du og {{count}} andre liker dette"},"vote":{"one":"Du og 1 anden stemte for dette indlæg","other":"Du og {{count}} andre stemte for dette indlæg"}},"by_others":{"off_topic":{"one":"1 person flagede dette som off-topic","other":"{{count}} personer flagede dette som off-topic"},"spam":{"one":"1 person flagede dette som spam","other":"{{count}} personer flagede dette som spam"},"inappropriate":{"one":"1 person flagede dette som upassende","other":"{{count}} personer flagede dette som upassende"},"notify_moderators":{"one":"1 person flagede dette til moderation","other":"{{count}} personer flagede dette til moderation"},"notify_user":{"one":"1 person sendte en privat besked til denne bruger","other":"{{count}} personer sendte en privat besked til denne bruger"},"bookmark":{"one":"1 person bogmærkede dette indlæg","other":"{{count}} personer bogmærkede dette indlæg"},"like":{"one":"1 person liker dette","other":"{{count}} personer liker dette"},"vote":{"one":"1 person stemte for dette indlæg","other":"{{count}} personer stemte for dette indlæg"}}},"edits":{"one":"én ændring","other":"{{count}} ændringer","zero":"ingen ændringer"},"delete":{"confirm":{"one":"Er du sikker på, at du vil slette indlægget?","other":"Er du sikker på, at du vil slette alle de valgte indlæg?"}},"revisions":{"controls":{"first":"Første udgave","previous":"Forrige udgave","next":"Næste udgave","last":"Sidste udgave","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e vs \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Vis det renderede output med tilføjelser og ændringer indlejret","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Vis de renderede output-diffs ved siden af hinanden","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Vis markdown-diffs ved siden af hinanden","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Markdown"}},"details":{"edited_by":"Redigeret af"}}},"category":{"can":"kan\u0026hellip; ","none":"(ingen kategori)","choose":"Vælg en kategori\u0026hellip;","edit":"redigér","edit_long":"Redigér","view":"Vis emner i kategori","general":"Overordnet","settings":"Indstillinger","delete":"Slet kategori","create":"Ny kategori","save":"Gem kategori","creation_error":"Der opstod en fejl under oprettelsen af kategorien.","save_error":"Der opstod en fejl da kategorien skulle gemmes.","name":"Kategorinavn","description":"Beskrivelse","topic":"kategoriemne","logo":"Kategori logo billede","background_image":"Kategori logo baggrundsbillede","badge_colors":"Mærkefarver","background_color":"Baggrundsfarve","foreground_color":"Tekstfarve","name_placeholder":"Bør være kort og kontant.","color_placeholder":"En web-farve","delete_confirm":"Er du sikker på, at du vil slette den kategori?","delete_error":"Der opstod en fejl ved sletning af kategorien.","list":"Kategoriliste","no_description":"Der er ingen beskrivelse for denne kategori.","change_in_category_topic":"besøg kategoriemnet for at redigere beskrivelsen","already_used":"This color has been used by another category","security":"Sikkerhed","images":"Billeder","auto_close_label":"Luk automatisk emner efter:","auto_close_units":"timer","email_in":"Brugerindstillet ingående email adresse:","email_in_allow_strangers":"Accepter emails fra ikke oprettede brugere","email_in_disabled":"Nye emner via email er deaktiveret i Site opsætning. For at aktivere oprettelse af nye emner via email,","email_in_disabled_click":"aktiver \"email ind\" indstilligen.","allow_badges_label":"Tillad af badges bliver tildelt i denne kategori","edit_permissions":"Redigér tilladelser","add_permission":"Tilføj tilladelse","this_year":"dette år","position":"position","default_position":"Standarposition","position_disabled":"Kategorier vil blive vist i rækkefølge efter aktivitet. For at styre rækkefølgen af kategorier i lister, ","position_disabled_click":"skal funktionen \"fikserede kategori positioner\" slås til.","parent":"Overordnet kategori","notifications":{"watching":{"title":"Kigger","description":"Du overvåger automatisk alle emner i disse kategorier. Du vil blive notificeret af alle nye indlæg og emner og antallet af ulæste og nye indlæg vil også stå ved siden af indlæggets emne."},"tracking":{"title":"Følger","description":"Du vil blive underrettet for hvert nyt indlæg i denne tråd. En optælling af nye indlæg vil blive vist ved siden af tråden."},"regular":{"title":"Standard","description":"Du får kun notifikationer hvis nogen nævner dit @navn eller svarer på dit indlæg."},"muted":{"title":"Ignoreret","description":"Du ignorerer automatisk alle emner i disse kategorier. De vil heller ikke stå i sin \"ulæste\" indikation."}}},"flagging":{"title":"Hvorfor flager du dette indlæg?","action":"Flag indlæg","take_action":"Reagér","notify_action":"Underret","delete_spammer":"Slet spammer","delete_confirm":"Du er ved at slette \u003cb\u003e%{posts}\u003c/b\u003e indlæg og \u003cb\u003e%{topics}\u003c/b\u003e emner oprettet af denne bruger, fjerne deres konto, blokere tilmeldinger fra deres IP-adresse \u003cb\u003e%{ip_address}\u003c/b\u003e og tilføje deres e-mail-adresse \u003cb\u003e%{email}\u003c/b\u003e til en permanent blokeringsliste. Er du sikker på, at denne bruger virkelig er en spammer?","yes_delete_spammer":"Ja, slet spammer","submit_tooltip":"Send privat markeringen","take_action_tooltip":"Nå til markerings niveauer med det samme, i stedet for at vente på flere markeringer fra fælleskabet","cant":"Beklager, du kan i øjeblikket ikke flage dette indlæg.","custom_placeholder_notify_user":"Hvorfor kræver dette indlæg at du taler privat og direkte med denne bruger? Vær specifik, konstruktiv og flink.","custom_placeholder_notify_moderators":"Hvorfor kræve dette indlæg moderatorernes opmærksomhed? Lad os vide hvad du specifikt er bekymret over, og inkludér om muligt relevante links.","custom_message":{"at_least":"indtast mindst {{n}} tegn","more":"{{n}} flere...","left":"{{n}} tilbage"}},"flagging_topic":{"title":"Hvorfor rapporterer du dette emne?","action":"Rapporter emne","notify_action":"Privat besked"},"topic_map":{"title":"Emne-resumé","links_shown":"vis alle {{totalLinks}} links...","clicks":{"one":"1 klik","other":"%{count} klik"}},"topic_statuses":{"locked":{"help":"emnet er låst; det modtager ikke flere svar"},"unpinned":{"title":"Ikke fastgjort","help":"Dette emne er ikke fastgjort; det vil blive vist i sin normale rækkefølge"},"pinned_globally":{"title":"Fastgjort globalt","help":"Dette emne er fastgjort globalt; det vil blive vist øverst på alle lister"},"pinned":{"title":"Fastgjort","help":"emnet er fastgjort; det vises i toppen af sin kategori"},"archived":{"help":"emnet er arkiveret; det er frosset og kan ikke ændres"},"invisible":{"help":"emnet er usynligt; det vises ikke på lister og kan kun tilgåes med et direkte link"}},"posts":"Indlæg","posts_lowercase":"indlæg","posts_long":"{{number}} indlæg i dette emne","original_post":"Oprindeligt indlæg","views":"Visninger","views_lowercase":"visninger","replies":"Svar","views_long":"dette emne er blevet vist {{number}} gange","activity":"Aktivitet","likes":"Likes","likes_lowercase":"likes","likes_long":"der er {{number}} likes i dette emne","users":"Deltagere","users_lowercase":"brugere","category_title":"Kategori","history":"Historik","changed_by":"af {{author}}","categories_list":"Kategorioversigt","filters":{"with_topics":"%{filter} emner","with_category":"%{filter} %{category} emner","latest":{"title":"Seneste","help":"de seneste emner"},"hot":{"title":"Populære","help":"de mest populære emner"},"starred":{"title":"Favoritter","help":"emner du har markeret som favoritter"},"read":{"title":"Læste","help":"emner du har læst"},"categories":{"title":"Kategorier","title_in":"Kategori - {{categoryName}}","help":"alle emner grupperet efter kategori"},"unread":{"title":{"zero":"Ulæste","one":"Ulæst (1)","other":"Ulæst ({{count}})"},"help":"emner du følger med i lige nu med ulæste indlæg","lower_title_with_count":{"one":"1 ulæst","other":"{{count}} ulæste"}},"new":{"lower_title_with_count":{"one":"1 ny","other":"{{count}} nye indlæg"},"lower_title":"Ny","title":{"zero":"Nye","one":"Ny (1)","other":"Nye ({{count}})"},"help":"Emner oprettet i de seneste par dage"},"posted":{"title":"Mine indlæg","help":"emner du har skrevet indlæg i"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"populære emner i kategorien {{categoryName}}"},"top":{"title":"Top","help":"de mest aktive emner i det sidse år, måned, uge og dag","yearly":{"title":"Top årligt"},"monthly":{"title":"Top månedligt"},"weekly":{"title":"Top ugentligt"},"daily":{"title":"Top dagligt"},"this_year":"Dette år","this_month":"Denne måned","this_week":"Denne uge","today":"I dag","other_periods":"Se flere top emner"}},"browser_update":"Desværre, \u003ca href=\"http://www.discourse.org/faq/#browser\"\u003edin browser er for gammel til at kunne virke med dette forum\u003c/a\u003e. \u003ca href=\"http://browsehappy.com\"\u003eOpgradér venligst din browser\u003c/a\u003e.","permission_types":{"full":"Opret / Besvar / Se","create_post":"Besvar / Se","readonly":"Se"},"type_to_filter":"skriv for at filtrere…","admin":{"title":"Discourse Admin","moderator":"Moderator","dashboard":{"title":"Dashboard","last_updated":"Dashboard sidst opdateret:","version":"Installeret version","up_to_date":"Du kører den seneste version af Discourse.","critical_available":"En kritisk opdatering er tilgængelig.","updates_available":"Opdatering er tilgængelige.","please_upgrade":"Opgradér venligst!","no_check_performed":"Der er ikke blevet søgt efter opdateringer. Kontrollér om sidekiq kører.","stale_data":"Der er ikke blevet søgt efter opdateringer på det seneste. Kontrollér om sidekiq kører.","version_check_pending":"Det ser ud til, at du har opgraderet for nyligt. Fantastisk!","installed_version":"Installeret","latest_version":"Seneste version","problems_found":"Der blev fundet problemer med din installation af Discourse:","last_checked":"Sidst kontrolleret","refresh_problems":"Opdatér","no_problems":"Ingen problemer fundet.","moderators":"Moderatorer:","admins":"Admins:","blocked":"Blokeret:","suspended":"Suspenderet:","private_messages_short":"PMs","private_messages_title":"Private beskeder","reports":{"today":"I dag","yesterday":"I går","last_7_days":"Seneste 7 dage","last_30_days":"Seneste 30 dage","all_time":"Altid","7_days_ago":"7 dage siden","30_days_ago":"30 dage siden","all":"Alle","view_table":"Vis som tabel","view_chart":"Vis som søjlediagram"}},"commits":{"latest_changes":"Seneste ændringer: opdatér ofte!","by":"af"},"flags":{"title":"Flag","old":"Gamle","active":"Aktive","agree":"Enig","agree_title":"Bekræft dette flag er gyldigt og korrekt","agree_flag_modal_title":"Enig og...","agree_flag_hide_post":"Enig (skjul indlæg + send PM)","agree_flag_hide_post_title":"Gem dette indlæg og send automatisk en privat besked til brugeren som tilskyndelse til at redigere det","agree_flag":"sæt markeringen til \"enig\"","agree_flag_title":"Sæt flaget til \"enig\" og behold indlægget uændret","defer_flag":"Udsæt","defer_flag_title":"Fjern dette flag; Det kræver ingen handling på nuværende tidspunkt.","delete":"Slet","delete_title":"Slet det indlæg, som flaget refererer til.","delete_post_defer_flag":"Slet indlægget og udsæt flaget","delete_post_defer_flag_title":"Slet indlægget; hvis det er det første, så slet hele emnet","delete_post_agree_flag":"Slet indlæg og sæt flaget til \"enig\"","delete_post_agree_flag_title":"Slet indlæg; hvis det er det første indlæg, slet emnet","delete_flag_modal_title":"Slet og...","delete_spammer":"Slet spammer","delete_spammer_title":"Fjern brugeren samt alle dens indlæg og emner.","disagree_flag_unhide_post":"Uenig (vis indlæg)","disagree_flag_unhide_post_title":"Fjern alle flag fra dette indlæg og gør det synligt igen","disagree_flag":"Uenig","disagree_flag_title":"Sæt dette flag som invalid eller forkert","clear_topic_flags":"Færdig","clear_topic_flags_title":"Emnet er kontrolleret og fundet ok. Klik på færdig for at fjerne rapporteringer.","more":"(flere svar...)","dispositions":{"agreed":"enig","disagreed":"uenig","deferred":"udsat"},"flagged_by":"Flaget af","resolved_by":"Løst af","took_action":"Reagerede","system":"System","error":"Noget gik galt","reply_message":"Svar","no_results":"Der er ingen flag.","topic_flagged":"Dette \u003cstrong\u003eemne\u003c/strong\u003e er blevet rapporteret til administrator.","visit_topic":"Besøg emnet for at gøre noget ved det","was_edited":"Indlægget blev redigeret efter det første gang blev flagget","summary":{"action_type_3":{"one":"off-topic","other":"off-topic x{{count}}"},"action_type_4":{"one":"upassende","other":"upassende x{{count}}"},"action_type_6":{"one":"brugerdefineret","other":"brugerdefinerede x{{count}}"},"action_type_7":{"one":"brugerdefineret","other":"brugerdefinerede x{{count}}"},"action_type_8":{"one":"spam","other":"spam x{{count}}"}}},"groups":{"primary":"Primær gruppe","no_primary":"(ingen primær gruppe)","title":"Grupper","edit":"Redigér grupper","refresh":"Genindlæs","new":"Nye","selector_placeholder":"tilføj brugere","name_placeholder":"Gruppenavn, ingen mellemrum, på samme måde som brugernavne","about":"Redigér gruppemedlemsskaber og gruppenavne her","group_members":"Gruppe medlemmer","delete":"Slet","delete_confirm":"Slet denne gruppe?","delete_failed":"Kan ikke slette gruppen. Hvis dette er en automatisk gruppe, kan den ikke ødelægges."},"api":{"generate_master":"Generér API-nøgle","none":"Der er ingen aktive API-nøgler i øjeblikket.","user":"Bruger","title":"API","key":"API-nøgle","generate":"Generér","regenerate":"Regenerér","revoke":"Tilbagekald","confirm_regen":"Er du sikker på, at du ønsker at erstatte API-nøglen med en ny?","confirm_revoke":"Er du sikker på, at du ønsker at tilbagekalde nøglen?","info_html":"Din API-nøgle giver dig mulighed for at oprette og opdatere emner vha. JSON-kald.","all_users":"Alle brugere","note_html":"Hold denne nøgle \u003cstrong\u003ehemmelig\u003c/strong\u003e, alle brugere som har den kan oprette vilkårlige indlæg, som enhver bruger."},"backups":{"title":"Backups","menu":{"backups":"Backups","logs":"Logs"},"none":"Ingen backups tilgængelige","read_only":{"enable":{"title":"Aktiver \"kun læsning\" tilstanden","text":"Aktiver \"kun læsning\" tilstanden","confirm":"Er du sikker på du vil aktivere \"kun læsning\" tilstranden?"},"disable":{"title":"Deaktiver \"kun læsning\" tilstanden","text":"Deaktiver \"kun læsning\" tilstanden"}},"logs":{"none":"Ingen logs endnu..."},"columns":{"filename":"Filnavn","size":"Størrelse"},"upload":{"text":"UPLOAD","uploading":"UPLOADER","success":"'{{filename}}' er blevet uploaded.","error":"Der skete en fejl da filen '{{filename}}' blev forsøgt uploaded: {{message}}"},"operations":{"is_running":"Der kører allerede en operation...","failed":"{{operation}} gik galt. Kig venligst i logfilerne.","cancel":{"text":"Annuller","title":"Annuller den nuværende handling","confirm":"Er du sikker på du vil annullere den nuværende handling?"},"backup":{"text":"Backup","title":"Start backup","confirm":"Vil du starte en ny backup?","without_uploads":"Ja (Uden upload)"},"download":{"text":"Download","title":"Download backuppen"},"destroy":{"text":"Slet","title":"Sletter backuppen","confirm":"Er du sikker på du vil fjerne denne backup?"},"restore":{"is_disabled":"Gendan er deaktiveret i forum indstillingerne.","text":"Gendan","title":"Gendan backuppen","confirm":"Er du sikker på du vil gendanne fra denne backup?"},"rollback":{"text":"Rul tilbage","title":"Rul databasen tilbage til et tidspunkt hvor tingene virkede","confirm":"Er du sikker på du vil rulle databasen tilbage?"}}},"export_csv":{"users":{"text":"Eksporter Brugere","title":"Eksporter brugerliste i en CSV-fil"},"success":"Eksport er påbegyndt, du får snart besked om hvordan det skrider frem.","failed":"Eksport fejlede. Tjek venligst loggen."},"customize":{"title":"Tilpasning","long_title":"Tilpasning af site","header":"Header","css":"Stylesheet","mobile_header":"Mobil header","mobile_css":"Mobilt stylesheet","override_default":"Inkludér ikke standard stylesheet","enabled":"Aktiveret?","preview":"forhåndsvisning","undo_preview":"skjul forhåndsvisning","rescue_preview":"standard stil","explain_preview":"Se sitet med dette stylesheet","explain_undo_preview":"Gå tilbage til det aktuelle ændrede stylesheet","explain_rescue_preview":"Se sitet med standard stylesheet","save":"Gem","new":"Ny","new_style":"Ny style","delete":"Slet","delete_confirm":"Slet denne tilpasning?","about":"Modificer CSS stylesheets og HTML headere på sitet. Tilføj en tilpasning for at starte.","color":"Farve","opacity":"Gennemsigtighed","copy":"Kopier","css_html":{"title":"CSS, HTML","long_title":"CSS og HTML tilpasninger"},"colors":{"title":"Farver","long_title":"Farve temaer","about":"Modificer farverne der bliver brugt på sitet uden at skrive CSS. Tilføj et tema for at begynde.","new_name":"Nyt farve tema","copy_name_prefix":"Kopi af","delete_confirm":"Slet dette farvetema?","undo":"fortryd","undo_title":"Fortryd dine ændringer til denne farve, siden sidste gang den blev gemt.","revert":"gendan","revert_title":"Nulstil denne farve til Discourse's standard farve tema.","primary":{"name":"Primær","description":"De fleste tekster, iconer og kanter."},"secondary":{"name":"sekundær","description":"Hoved baggrunds farven og tekst farven på enkelte knapper."},"tertiary":{"name":"tredie","description":"Links, nogle knapper, notifikationer og accent farver."},"quaternary":{"name":"fjerde","description":"Navigations links."},"header_background":{"name":"titel baggrund","description":"Baggrunds farve på sitets titel."},"header_primary":{"name":"titel primær","description":"Tekst og iconer i sitets titel."},"highlight":{"name":"fremhæv","description":"Baggrundsfarven på fremhævede elementer på siden, såsom emner og indlæg."},"danger":{"name":"fare","description":"Fremhævet farve på handlinger såsom sletning af indlæg og emner."},"success":{"name":"succes","description":"Bruges til at indikere at en handling gik godt."},"love":{"name":"kærlighed","description":"Like knappens farve."}}},"email":{"title":"E-mail","settings":"Indstillinger","all":"Alle","sending_test":"Sender test email...","test_error":"Der opstod et problem med at sende test emailen. Dobbelt check dine email indstillinger, verificer at din server ikke blokerer email forbindelser og prøv så igen.","sent":"Sendt","skipped":"Droppet","sent_at":"Sendt","time":"Tidspunkt","user":"Bruger","email_type":"E-mail-type","to_address":"Modtager","test_email_address":"e-mail-adress der skal testes","send_test":"send test-e-mail","sent_test":"sednt!","delivery_method":"Leveringsmetode","preview_digest":"Forhåndsvisning af sammendrag","preview_digest_desc":"Dette er et værktøj til forhåndsvisning af de sammendrag, som dit forum sender ud.","refresh":"Opdatér","format":"Format","html":"html","text":"text","last_seen_user":"Sidst sete bruge:","reply_key":"Svarnøgle","skipped_reason":"Begrundelse","logs":{"none":"Ingen logs fundet","filters":{"title":"Filter","user_placeholder":"brugernavn","address_placeholder":"navn@eksempel.dk","type_placeholder":"sammenfatning, tilmelding...","skipped_reason_placeholder":"grund"}}},"logs":{"title":"Logs","action":"Handling","created_at":"Oprettet","last_match_at":"Sidste matchet","match_count":"Matches","ip_address":"IP","delete":"Slet","edit":"Redigér","save":"Gem","screened_actions":{"block":"blokér","do_nothing":"gør intet"},"staff_actions":{"title":"Handlinger","instructions":"Klik på brugernavne og handlinger for at filtrere listen. Klik på avatarer for at gå til brugersider.","clear_filters":"Vis alt","staff_user":"Bruger","target_user":"Bruger","subject":"Subjekt","when":"Hvorår","context":"Kontekst","details":"Detaljer","previous_value":"Forrige","new_value":"Ny","diff":"Diff","show":"Vis","modal_title":"Detaljer","no_previous":"Der er ingen forrig værdi.","deleted":"Ingen ny værdi. Rækken blev slettet.","actions":{"delete_user":"slet bruger","change_trust_level":"skift tillidsniveau","change_site_setting":"skift indstillinger for site","change_site_customization":"skift tilpasning af site","delete_site_customization":"slet tilpasning af site","suspend_user":"suspendér user","unsuspend_user":"ophæv suspendering af bruger","grant_badge":"tildel badge","revoke_badge":"fratag badge"}},"screened_emails":{"title":"Blokerede e-mails","description":"Følgende e-mail-adresser kontrolleres når nogen prøver at oprette en konto, og oprettelsen vil enten blive blokeret, eller der vil blive foretaget en anden handling.","email":"E-mail-adresse","actions":{"allow":"Tillad"}},"screened_urls":{"title":"Blokerede URLer","description":"URLerne nedenfor er blevet brugt i indlæg af brugere, som er blevet identificeret som spammere.","url":"URL","domain":"Domain"},"screened_ips":{"title":"Blokerede IPer","description":"IP-adresser som bliver overvåget. Brug \"Tillad\" for at whiteliste IP-addresser.","delete_confirm":"Er du sikker på, at du ønsker at fjerne reglen for %{ip_address}?","actions":{"block":"Blokér","do_nothing":"Tillad"},"form":{"label":"Ny:","ip_address":"IP-adresse","add":"Tilføj"}},"logster":{"title":"Fejl beskeder"}},"impersonate":{"title":"Skift personlighed","help":"Brug dette værktøj til at udgive dig for en anden bruger til brug for debugging. Du skal logge ud når du er færdig."},"users":{"title":"Brugere","create":"Tilføj admin-bruger","last_emailed":"Sidst mailet","not_found":"Beklager, brugernavnet findes ikke i vores system.","active":"Aktiv","nav":{"new":"Ny","active":"Aktiv","pending":"Afventer","admins":"Admins","moderators":"Mods","suspended":"Suspenderet","blocked":"Blokeret"},"approved":"Godkendt?","approved_selected":{"one":"godkend bruger","other":"godkend brugere ({{count}})"},"reject_selected":{"one":"afvis bruger","other":"afvis brugere ({{count}})"},"titles":{"active":"Aktive brugere","new":"Nye brugere","pending":"Brugere som afvanter godkendelse","newuser":"Brugere på tillidsniveau 0 (Ny bruger)","basic":"Brugere på tillidsniveau 1 (Basisbruger)","regular":"Brugere på tillidsniveau 2 (Almindelig bruger)","leader":"Brugere på tillidsniveau 3 (Veteran)","elder":"Brugere på tillidsniveau 4 (Advanceret bruger)","admins":"Admin-brugere","moderators":"Moderatorer","blocked":"Blokerede brugere","suspended":"Suspenderede brugere"},"reject_successful":{"one":"Afviste 1 bruger.","other":"Afviste %{count} brugere."},"reject_failures":{"one":"Kunne ikke afvise 1 bruger.","other":"Kunne ikke afvise %{count} brugere."},"not_verified":"Ikke verificeret"},"user":{"suspend_failed":"Noget gik galt ved suspenderingen af denne bruger {{error}}","unsuspend_failed":"Noget gik galt ved ophævningen af denne brugers suspendering {{error}}","suspend_duration":"Hvor lang tid skal brugeren være suspenderet?","suspend_duration_units":"(dage)","suspend_reason_label":"Hvorfor suspenderer du? Denne tekst \u003cb\u003eer synlig for alle\u003c/b\u003e på brugerens profilside, og vises til brugeren når de prøver at logge ind. Fat dig i korthed.","suspend_reason":"Begrundelse","suspended_by":"Suspenderet af","delete_all_posts":"Slet alle indlæg","delete_all_posts_confirm":"Du er ved at slette %{posts} indlæg og %{topics} emner. Er du sikker?","suspend":"Suspendér","unsuspend":"Ophæv suspendering","suspended":"Suspenderet?","moderator":"Moderator?","admin":"Admin?","blocked":"Blokeret?","show_admin_profile":"Admin","edit_title":"Redigér titel","save_title":"Gem titel","refresh_browsers":"Gennemtving browser refresh","refresh_browsers_message":"Beskeden er sendt til alle tilsluttede browsere!","show_public_profile":"Vis offentlig profil","impersonate":"Impersonate","ip_lookup":"IP opslag","log_out":"Log ud","logged_out":"Bruger er logget ud på alle enheder","revoke_admin":"Fratag admin","grant_admin":"Tildel admin","revoke_moderation":"Fratag moderation","grant_moderation":"Tildel moderation","unblock":"Ophæv blokering","block":"Blokér","reputation":"Omdømme","permissions":"Tilladelser","activity":"Aktivitet","like_count":"Likes Givet / Modtaget","last_100_days":"de sidste 100 dage","private_topics_count":"Private emner","posts_read_count":"Læste indlæg","post_count":"Oprettede indlæg","topics_entered":"Læste emner","flags_given_count":"Afgivne flag","flags_received_count":"Modtagne flag","flags_given_received_count":"Flag Givet / Modtaget","approve":"Godkend","approved_by":"godkendt af","approve_success":"Bruger godkendt og e-mail med aktiveringsvejledning sendt.","approve_bulk_success":"Succes! Alle valgte brugere er blevet godkendt og underrettet.","time_read":"Læsetid","delete":"Slet bruger","delete_forbidden_because_staff":"Admins og moderatorer kan ikke slettes.","delete_forbidden":{"one":"Brugere kan ikke slettes hvis de har oprettet sig for mere end %{count} dag siden, eller hvis de har oprettet indlæg. Slet alle indlæg før du forsøger at slette en bruger.","other":"Brugere kan ikke slettes hvis de har oprettet sig for mere end %{count} dage siden, eller hvis de har oprettet indlæg. Slet alle indlæg før du forsøger at slette en bruger."},"cant_delete_all_posts":{"one":"Kan ikke slette alle indlæg. Der er indlæg der er over %{count} dag gamle. (Juster delete_user_max_post_age indstillingen.)","other":"Kan ikke slette alle indlæg. Der er indlæg der er over %{count} dage gamle. (Juster delete_user_max_post_age indstillingen.)"},"cant_delete_all_too_many_posts":{"one":"Kan ikke slette alle indlæg fordi denne bruger har flere end 1 indlæg. (delete_all_posts_max indstillingen)","other":"Kan ikke slette alle indlæg fordi denne bruger har flere end %{count} indlæg. (delete_all_posts_max indstillingen)"},"delete_confirm":"Er du SIKKER på at du slette denne bruger? Det er permanent! ","delete_and_block":"Slet og \u003cb\u003ebloker\u003c/b\u003e denne email og IP-adresse","delete_dont_block":"Slet kun","deleted":"Brugeren blev slettet.","delete_failed":"Der opstod en fejl ved sletning af brugeren. Kontrollér om alle indlæg er slettet før du prøver at slette brugeren.","send_activation_email":"Send aktiverings-e-mail","activation_email_sent":"Aktiverings-e-mail sendt.","send_activation_email_failed":"Der opstod et problem ved afsendelse af aktiverings-e-mailen. %{error}","activate":"Aktivér konto","activate_failed":"Der opstod et problem ved aktivering af brugeren.","deactivate_account":"Deaktivér konto","deactivate_failed":"Der opstod et problem ved deaktivering af brugeren.","unblock_failed":"Der opstod et problem ved ophævelsen af brugerens blokering.","block_failed":"Der opstod et problem ved blokering af brugeren.","deactivate_explanation":"En deaktiveret bruger skal genvalidere deres e-mail.","suspended_explanation":"En suspenderet bruger kan ikke logge ind.","block_explanation":"En blokeret bruger kan ikke oprette indlæg eller starte emner.","trust_level_change_failed":"Der opstod et problem ved ændringen af brugerens tillidsniveau.","suspend_modal_title":"Suspendér bruger","trust_level_2_users":"Tillids niveau 2 brugere","trust_level_3_requirements":"Fortrolighedsniveau 3 påkrævet","tl3_requirements":{"title":"Krav for fortrolighedsniveau 3","table_title":"For de sidste 100 dage:","value_heading":"værdi","requirement_heading":"Obligatoriske","visits":"Besøg","days":"dage","topics_replied_to":"Emner med svar","topics_viewed":"Emner åbnet","topics_viewed_all_time":"Emner åbnet (siden begyndelsen)","posts_read":"Læste indlæg","posts_read_all_time":"Indlæg læst (siden begyndelsen)","flagged_posts":"Markerede indlæg","flagged_by_users":"Brugere der har markeret indlæg","likes_given":"Likes givet","likes_received":"Likes modtaget","qualifies":"Krav for tillidsniveau 3","will_be_promoted":"Vil blive forfremmet indenfor 24 timer.","does_not_qualify":"Ikke kvalificeret til tillids niveau 3."},"sso":{"title":"Single Sign On","external_id":"Externt ID","external_username":"Brugernavn","external_name":"Navn","external_email":"Email","external_avatar_url":"Avatar URL"}},"site_content":{"none":"Vælg en indholdstype for at begynde at redigere.","title":"Indhold","edit":"Redigér indhold"},"site_settings":{"show_overriden":"Vis kun tilsidesatte","title":"Indstillinger","reset":"nulstil","none":"ingen","no_results":"Ingen resultater fundet.","clear_filter":"Ryd","categories":{"all_results":"Alle","required":"Obligatoriske","basic":"Grundlæggende","users":"Brugere","posting":"Indlæg","email":"E-mail","files":"Filer","trust":"Tillidsniveauer","security":"Sikkerhed","onebox":"Onebox","seo":"SEO","spam":"Spam","rate_limits":"Begrænsninger","developer":"Udvikler","embedding":"Indlejring","legal":"Jura","uncategorized":"Andre","backups":"Backups","login":"Brugernavn"}},"badges":{"title":"Badges","new_badge":"Nyt Badge","new":"Nye","name":"Navn","badge":"Badge","display_name":"Vist navn","description":"Beskrivelse","badge_type":"Badge Type","badge_grouping":"Gruppe","badge_groupings":{"modal_title":"Badge grupperinger"},"granted_by":"Givet af","granted_at":"Givet på","save":"Gem","delete":"Slet","delete_confirm":"Er du sikker på du vil slette denne badge ?","revoke":"Fratag","revoke_confirm":"Er du sikker på du vil fratage brugeren denne badge ?","edit_badges":"Rediger Badges","grant_badge":"Tildel Badge","granted_badges":"Tildelte Badges","grant":"Givet","no_user_badges":"%{name} had ikke feet nogen badges.","no_badges":"Der er ikke nogen badges, der kan tildeles.","allow_title":"Tillad at bruge denne badge som titel","multiple_grant":"Kan gives flere gange","listable":"Vi badges på den offentlige badge side","enabled":"Aktiver badge","icon":"Icon","query":"Badge Forespørgesel (SQL)","target_posts":"Forespørg mål indlæg","auto_revoke":"Kør tilbagekaldelses forespørgsel hver dag","show_posts":"Vis det indlæg der gav et badge på badge siden","trigger":"Trigger","trigger_type":{"none":"Opdater dagligt","post_action":"Når en bruger reagerer på et indlæg","post_revision":"Når en bruger redigerer eller opretter et indlæg","trust_level_change":"Når en bruger skifter tillidsniveau","user_change":"Når en bruger er redigeret eller oprettet"},"preview":{"link_text":"Forhåndsvisning af opnåede badges","plan_text":"Forhåndsvisning med forespørgsels plan (SQL)","modal_title":"Badge Forespørgesel forhåndsvisning (SQL)","sql_error_header":"Der var en fejl i forespørgslen","error_help":"Se disse links for hjælp med at skrive badge forespørgsler.","bad_count_warning":{"header":"ADVARSEL!"}}}},"lightbox":{"download":"download"},"keyboard_shortcuts_help":{"title":"Tastatur genveje","jump_to":{"title":"Hop til","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e Hjem (Seneste)","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e Seneste","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e Nye","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e Ulæste","starred":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ef\u003c/b\u003e Favoritter","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Kategorier"},"navigation":{"title":"Navigation","jump":"\u003cb\u003e#\u003c/b\u003e Gå til indlæg nummer","back":"\u003cb\u003eu\u003c/b\u003e Tilbage","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Flyt det valgte op/ned","open":"\u003cb\u003eo\u003c/b\u003e eller \u003cb\u003eEnter\u003c/b\u003e Åbn det valgte emne"},"application":{"title":"Applikation","create":"\u003cb\u003ec\u003c/b\u003e Opret et nyt emne","notifications":"\u003cb\u003en\u003c/b\u003e Åbn notifikationer","search":"\u003cb\u003e/\u003c/b\u003e Søg","help":"\u003cb\u003e?\u003c/b\u003e Åbn hjælp til tastaturgenveje"},"actions":{"title":"Handlinger","star":"\u003cb\u003ef\u003c/b\u003e Markér emne som favorit","share_topic":"\u003cb\u003eshift s\u003c/b\u003e Del emne","share_post":"\u003cb\u003es\u003c/b\u003e Del opslag","reply_topic":"\u003cb\u003eshift r\u003c/b\u003e Svar på emnet","reply_post":"\u003cb\u003er\u003c/b\u003e Svar på kommentaren","quote_post":"\u003cb\u003eq\u003c/b\u003e Citer emne","like":"\u003cb\u003el\u003c/b\u003e Like indlæg","flag":"\u003cb\u003e!\u003c/b\u003e Flag indlæg","bookmark":"\u003cb\u003eb\u003c/b\u003e Bogmærk indlæg","edit":"\u003cb\u003ee\u003c/b\u003e Redigér indlæg","delete":"\u003cb\u003ed\u003c/b\u003e Slet indlæg","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Lydløst emne","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Almindelig (stardard) emne","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Følg emne","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e Iagtag emne"}},"badges":{"title":"Badges","allow_title":"tillad denne badge benyttes som en titel?","multiple_grant":"givet flere gange?","badge_count":{"one":"1 Badge","other":"%{count} Badges"},"more_badges":{"one":"+1 Mere","other":"+%{count} Mere"},"granted":{"one":"1 givet","other":"%{count} givet"},"select_badge_for_title":"Vælg en badge, du vil bruge som din titel","no_title":"\u003cingen titel\u003e","badge_grouping":{"getting_started":{"name":"Kom igang"},"community":{"name":"Fælleskab"},"trust_level":{"name":"Tillidsniveau"},"other":{"name":"Andre"},"posting":{"name":"Indlæg"}},"badge":{"editor":{"name":"Redigering","description":"Første indlæg redigering"},"basic_user":{"name":"Basic","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/4\"\u003eGivet\u003c/a\u003e alle vigtige fællesskab funktioner"},"regular_user":{"name":"Standard","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/5\"\u003eGivet\u003c/a\u003e invitationer"},"leader":{"name":"Leder","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/6\"\u003eGivet\u003c/a\u003e rekategorisering, omdøbning, fulgte links og lounge"},"elder":{"name":"advanceret bruger","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/7\"\u003eGivet\u003c/a\u003e global redigering, fastgøring, lukning, arkivering, del og samling"},"welcome":{"name":"Velkommen","description":"Modtaget et like"},"autobiographer":{"name":"Selvbiografi","description":"Har udfyldt sin \u003ca href=\"/my/preferences\"\u003eprofil\u003c/a\u003e information"},"nice_post":{"name":"Fint indlæg","description":"Har modtaget 10 \"likes\" på et indlæg. Denne badge kan modtages flere gange."},"good_post":{"name":"Godt indlæg","description":"Har modtaget 25 \"likes\" på et indlæg. Denne badge kan modtages flere gange."},"great_post":{"name":"Rigtig godt indlæg","description":"Har modtaget 50 \"likes\" på et indlæg. Denne badge kan modtages flere gange."},"first_like":{"name":"Første like","description":"Har liked et indlæg"},"first_flag":{"name":"Første markering","description":"Markeret et indlæg"},"first_share":{"name":"Første deling","description":"Delt et indlæg"},"first_link":{"name":"Første link","description":"Internt link til et andet emne tilføjet"},"first_quote":{"name":"Første citering","description":"Citeret en bruger"},"read_guidelines":{"name":"Læst retningslinierne","description":"Har læst \u003ca href=\"/guidelines\"\u003eretningslinierne for forummet\u003c/a\u003e"},"reader":{"name":"Læser","description":"Har læst hver eneste indlæg i et emne med mere end 100 posts"}}}}}};
I18n.locale = 'da';
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
// locale : danish (da)
// author : Ulrik Nielsen : https://github.com/mrbase

(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define(['moment'], factory); // AMD
    } else if (typeof exports === 'object') {
        module.exports = factory(require('../moment')); // Node
    } else {
        factory(window.moment); // Browser global
    }
}(function (moment) {
    return moment.defineLocale('da', {
        months : "januar_februar_marts_april_maj_juni_juli_august_september_oktober_november_december".split("_"),
        monthsShort : "jan_feb_mar_apr_maj_jun_jul_aug_sep_okt_nov_dec".split("_"),
        weekdays : "søndag_mandag_tirsdag_onsdag_torsdag_fredag_lørdag".split("_"),
        weekdaysShort : "søn_man_tir_ons_tor_fre_lør".split("_"),
        weekdaysMin : "sø_ma_ti_on_to_fr_lø".split("_"),
        longDateFormat : {
            LT : "HH:mm",
            L : "DD/MM/YYYY",
            LL : "D. MMMM YYYY",
            LLL : "D. MMMM YYYY LT",
            LLLL : "dddd [d.] D. MMMM YYYY LT"
        },
        calendar : {
            sameDay : '[I dag kl.] LT',
            nextDay : '[I morgen kl.] LT',
            nextWeek : 'dddd [kl.] LT',
            lastDay : '[I går kl.] LT',
            lastWeek : '[sidste] dddd [kl] LT',
            sameElse : 'L'
        },
        relativeTime : {
            future : "om %s",
            past : "%s siden",
            s : "få sekunder",
            m : "et minut",
            mm : "%d minutter",
            h : "en time",
            hh : "%d timer",
            d : "en dag",
            dd : "%d dage",
            M : "en måned",
            MM : "%d måneder",
            y : "et år",
            yy : "%d år"
        },
        ordinal : '%d.',
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
