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
MessageFormat.locale.ro = function (n) {
  if (n == 1) {
    return 'one';
  }
  if (n === 0 || n != 1 && (n % 100) >= 1 &&
      (n % 100) <= 19 && n == Math.floor(n)) {
    return 'few';
  }
  return 'other';
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
r += "Acolo ";
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
r += "is <a href='/necitit'>1 unread</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "are <a href='/necitite'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " unread</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ro"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += " <a href='/nou'>1 new</a> topic";
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
r += " <a href='/noi'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " new</a> topics";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ro"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " remaining, or ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "browse other topics in ";
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
}});I18n.translations = {"ro":{"js":{"number":{"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}}},"dates":{"tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c 1s","other":"\u003c %{count}s"},"x_seconds":{"one":"1s","other":"%{count}s"},"less_than_x_minutes":{"one":"\u003c 1m","other":"\u003c %{count}m"},"x_minutes":{"one":"1m","other":"%{count}m"},"about_x_hours":{"one":"1o","other":"%{count}o"},"x_days":{"one":"1z","other":"%{count}z"},"about_x_years":{"one":"1a","other":"%{count}a"},"over_x_years":{"one":"\u003e 1a","other":"\u003e %{count}a"},"almost_x_years":{"one":"1a","other":"%{count}a"},"date_month":"Z LLL","date_year":"LLL 'AA"},"medium":{"x_minutes":{"one":"1 min","other":"%{count} minute"},"x_hours":{"one":"1 ora","other":"%{count} ore"},"x_days":{"one":"1 zi","other":"%{count} zile"},"date_year":"Z LL AAAA"},"medium_with_ago":{"x_minutes":{"one":"acum 1 minut ","other":"acum %{count} minut"},"x_hours":{"one":"acum 1 oră","other":"acum %{count} ore"},"x_days":{"one":"acum 1 zi","other":"acum %{count} zile"}}},"share":{"topic":"distribuie adresă către această discuţie","post":"distribuie o adresă către postarea #%{postNumber}","close":"închide","twitter":"distribuie această adresă către Twitter","facebook":"distribuie această adresă către Facebook","google+":"distribuie această adresă către Google+","email":"trimite această adresă în email"},"edit":"editează titlul şi categoria acestui subiect","not_implemented":"Această caracteristică nu a fost implementată încă, ne pare rău!","no_value":"Nu","yes_value":"Acceptă","generic_error":"Ne pare rău, a avut loc o eroare.","generic_error_with_reason":"A avut loc o eroare: %{error}","log_in":"Autentificare","age":"Vârsta","last_post":"Ultima Postare","joined":"Adăugat","admin_title":"Admin","flags_title":"Semnalare","show_more":"Detaliază","links":"Adrese","links_lowercase":"Adrese","faq":"Întrebări","guidelines":"Ajutor","privacy_policy":"Politică de confidenţialitate","privacy":"Confidenţialitate","terms_of_service":"Termenii serviciului","mobile_view":"Ecran pentru mobil","desktop_view":"Ecran pentru desktop","you":"Dumneavoastră","or":"sau","now":"Adineauri","read_more":"citeşte mai mult","more":"Mai mult","less":"Mai puţin","never":"Niciodată","daily":"Zilnic","weekly":"Săptămânal","every_two_weeks":"Odată la două săptamâni","max":"Maxim","character_count":{"one":"{{count}} caracter","other":"{{count}} de caractere"},"in_n_seconds":{"one":"într-o secundă","other":"în {{count}} de secunde"},"in_n_minutes":{"one":"într-un minut","other":"în {{count}} de minute"},"in_n_hours":{"one":"într-o oră","other":"în {{count}} de ore"},"in_n_days":{"one":"într-o zi","other":"în {{count}} de zile"},"suggested_topics":{"title":"Subiecte Propuse"},"bookmarks":{"not_logged_in":"Ne pare rău, probabil nu eşti logat la postările de semn de carte","created":"Ai pus semn de carte pe acestă postare","not_bookmarked":"Ai citit deja această postare; fă click să adaugi semn de carte","last_read":"Acesta e ultima postare citită de tine; fă click să adaugi semn de carte","remove":"Semn de carte înlăturat"},"topic_count_latest":{"one":"{{count}} discuţie nouă sau actualizată.","other":"{{count}} discuţii noi sau actualizate."},"topic_count_unread":{"one":"{{count}} discuţie necitită.","other":"{{count}} discuţii necitite."},"topic_count_new":{"one":"{{count}} subiect nou.","other":"{{count}} subiecte noi."},"click_to_show":"Click pentru vizualizare.","preview":"vizualizează","cancel":"anulează","save":"Salvează Schimbările","saving":"Salvează...","saved":"Salvat!","upload":"Încarcă","uploading":"Încărcare...","uploaded":"Încărcat!","enable":"Activează","disable":"Dezactivează","undo":"Anulează acţiunea precedentă","revert":"Rescrie acţiunea precedentă","banner":{"close":"Ignoră acest banner."},"choose_topic":{"none_found":"Nu au fost găsite discuţii.","title":{"search":"Caută o discuţie după nume, url sau id:","placeholder":"Scrie aici titlul discuţiei"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e a postat \u003ca href='{{topicUrl}}'\u003ediscuţia\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eYou\u003c/a\u003e a postat \u003ca href='{{topicUrl}}'\u003ediscuţia\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003ea răspuns la\u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eYou\u003c/a\u003e a răspuns la \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e a răspuns la \u003ca href='{{topicUrl}}'\u003ediscuţie\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eYou\u003c/a\u003e a răspuns la \u003ca href='{{topicUrl}}'\u003ediscuţie\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e a menţionat \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e a menţionat \u003ca href='{{user2Url}}'\u003eyou\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eYou\u003c/a\u003e a menţionat \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Postat de către \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Postat de către \u003ca href='{{userUrl}}'\u003etine\u003c/a\u003e","sent_by_user":"Trimis de către \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Trimis de către \u003ca href='{{userUrl}}'\u003etine\u003c/a\u003e"},"groups":{"visible":"Grupul este vizibil tuturor utilizatorilor","title":{"one":"grup","other":"grupuri"},"members":"Membri","posts":"Postări","alias_levels":{"title":"Cine poate folosii acest grup ca pseudonim?","nobody":"Nimeni","only_admins":"Doar Adminii","mods_and_admins":"Doar moderatorii şi adminii","members_mods_and_admins":"Doar membri grupului, moderatorii şi adminii","everyone":"Toată lumea"}},"user_action_groups":{"1":"Aprecieri Date","2":"Aprecieri Primite","3":"Semne de carte","4":"Discuţii","5":"Postări","6":"Răspunsuri","7":"Menţiuni","9":"Citate","10":"Participări","11":"Editări","12":"Obiecte Trimise","13":"Primite"},"categories":{"all":"toate categoriile","all_subcategories":"toate","no_subcategory":"niciuna","category":"Categorie","posts":"Postări","topics":"Discuţii","latest":"Ultimele","latest_by":"recente dupa","toggle_ordering":"Control comandă comutare","subcategories":"Subcategorie","topic_stats":"Numărul de discuţii noi.","topic_stat_sentence":{"one":"%{count} discuţie nouă în trecut %{unit}.","other":"%{count} discuţii noi în trecut %{unit}."},"post_stats":"Numărul de postări noi.","post_stat_sentence":{"one":"%{count} postare nouă în trecut %{unit}.","other":"%{count} de postări noi în trecut %{unit}."}},"ip_lookup":{"title":"Căutare adresă IP","hostname":"Nume gazdă","location":"Locaţie","location_not_found":"(necunoscut)","organisation":"Organizaţie","phone":"Telefon","other_accounts":"Alte conturi cu această adresă IP","no_other_accounts":"(niciunul)"},"user":{"said":"{{username}} a spus:","profile":"Profil","show_profile":"Vizitează Profilul","mute":"Anulează","edit":"Editează Preferinţe","download_archive":"descarcă arhiva postărilor mele","private_message":"Mesaj Privat","private_messages":"Mesaje","activity_stream":"Activitate","preferences":"Preferinţe","bookmarks":"Semne de carte","bio":"Despre mine","invited_by":"Invitat de","trust_level":"Nivel de Încredere","notifications":"Notificări","disable_jump_reply":"Nu sării la un post nou după răspuns","dynamic_favicon":"Arată notificări pentru mesajele primite la favorite (experimental)","edit_history_public":"Permite altor utilizatori să vizualizeze reviziile postului meu","external_links_in_new_tab":"Deschide toate adresele externe într-un tab nou","enable_quoting":"Activează răspunsuri-citat pentru textul selectat","change":"schimbă","moderator":"{{user}} este moderator","admin":"{{user}} este admin","moderator_tooltip":"Acest user este moderator","admin_tooltip":"Acest user este admin","suspended_notice":"Acest user este suspendat păna la {{date}}.","suspended_reason":"Motiv: ","mailing_list_mode":"Primeşte email de câte ori se postează pe forum (daca nu anulaţi topicul sau categoria)","watched_categories":"Văzut","watched_categories_instructions":"Vezi automat toate postările noi din aceste categorii. Veţi fi notificat pentru toate postările şi discuţiile nou apărute, plus numărul mesajelor necitite şi al postărilor noi va fi afişat lânga listarea discuţiei.","tracked_categories":"Tracked","tracked_categories_instructions":"Veţi urmării automat toate discuţiile noi din aceaste categorii. Numărul postărilor noi va fi afişat langă listarea discuţiei.","muted_categories":"Muted","muted_categories_instructions":"Nu vei fii notificat de dicuţiile apărute în aceste categorii şi ele nu vor apărea în tabul necitite.","delete_account":"Şterge-mi contul","delete_account_confirm":"Eşti sigur că vrei sa ştergi contul? Această acţiune poate fi anulată!","deleted_yourself":"Contul tău a fost şters cu succes.","delete_yourself_not_allowed":"Nu iţi poţi sterge contul deocamdată. Contactează administratorul pentru ştergerea contului.","unread_message_count":"Mesaje","staff_counters":{"flags_given":"Semnale ajutătoare","flagged_posts":"postări semnalate","deleted_posts":"postări şterse","suspensions":"suspendări"},"messages":{"all":"Toate","mine":"Ale mele","unread":"Necitite"},"change_password":{"success":"(email trimis)","in_progress":"(se trimite email)","error":"(eroare)","action":"Trimite email pentru resetare parolă","set_password":"Introduceţi parolă"},"change_about":{"title":"Schimbă la Profil"},"change_username":{"title":"Schimbă numele utilizatorului","confirm":"Dacă schimbaţi numele utilizatorului, toate citatele din posturile precedente inclusiv menţiunile de nume vor fi anulate. Eşti absolut sigur?","taken":"Ne pare rău, acest nume de utilizator este deja folosit.","error":"S-a intâmpinat o eroare pe parcursul schimbării numelui de utilizator.","invalid":"Acest nume de utilizator este invalid. Trebuie să includă doar cifre şi litere."},"change_email":{"title":"Schimbă Email","taken":"Ne pare rău, acest email nu este disponibil.","error":"S-a întâmpinat o eroare la schimbarea de email. Poate această adresă este deja in folosinţa?","success":"Am trimis un email către adresa respectivă. Urmaţi, vă rugăm, instrucţiunile de confirmare."},"change_avatar":{"title":"Schimbă avatarul","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, bazat pe","refresh_gravatar_title":"Reîmprospataţi Gravatarul","letter_based":"Avatar dat de sistem","uploaded_avatar":"Poză preferată","uploaded_avatar_empty":"Adaugă poza preferată","upload_title":"Încarcă poza personală","upload_picture":"Încarcă poza","image_is_not_a_square":"Atenţie: poza a fost ajustată, nu este pătrată."},"change_profile_background":{"title":"Datele Profilului"},"email":{"title":"Email","instructions":"Emailul dumneavoastră nu va fi făcut public.","ok":"Arată bine. Vă trimitem un email pentru confirmare.","invalid":"introduceţi o adresă validă pentru confirmare.","authenticated":"Emailul dumneavoastră a fost autentificat de către {{provider}}.","frequency":"Emailuri vor fi trimise către dumneavoastră doar dacă aţi lipsit recent sau nu aţi văzut lucrurile ce constituie subiectul emailului."},"name":{"title":"Nume","instructions":"Versiunea lungă a numelui.","too_short":"Numele este prea scurt.","ok":"Numele dvs arată bine."},"username":{"title":"Nume Utilizator","instructions":"Numele de utilizator trebuie sa fie unic, fără spaţii, scurt.","short_instructions":"Ceilalţi te pot numii @{{username}}.","available":"Numele de utilizator este valabil.","global_match":"Emailul se potriveşte numelui de utilizator înregistrat.","global_mismatch":"Deja înregistrat. Încearcă:{{suggestion}}?","not_available":"Nu este valabil. Încearcă:{{suggestion}}?","too_short":"Numele de utilizator este prea scurt.","too_long":"Numele de utilizator este prea lung.","checking":"Verifică valabilitatea numelui de utilizator...","enter_email":"Nume de utilizator găsit. Introduceţi emailul potrivit.","prefilled":"Emailul se potriveşte cu numele de utilizator înregistrat."},"locale":{"title":"Limba interfeţei","instructions":"Limba este folosită de interfaţa forumului. Schimbarea se va produce odată ce reîmprospataţi pagina.","default":"(din oficiu)"},"password_confirmation":{"title":"Incă odată parola"},"last_posted":"Ultima postare","last_emailed":"Ultimul email dat","last_seen":"Văzut","created":"Participare","log_out":"Ieşire","location":"Locaţie","website":"Website","email_settings":"Email","email_digests":{"title":"Cand nu vizitaţi site-ul, veţi primii un email cu rezumatul noutăţilor:","daily":"zilnic","weekly":"săptămânal","bi_weekly":"odată la două saptămâni"},"email_direct":"Primeşte un email când cineva te citeaza, iţi răspunde la postare,sau iţi menţionează @numele de utilizator","email_private_messages":"Primeşte un email când cineva trimite un mesaj privat.","email_always":"Primeşti notificări şi email-rezumat chiar dacă eşti activ pe forum.","other_settings":"Altele","categories_settings":"Categorii","new_topic_duration":{"label":"Consideră discuţiile ca fiind noi","not_viewed":"când nu au fost vizualizate","last_here":"create de când nu aţi mai fost activ ultima oară.","after_n_days":{"one":"create în ultima zi","other":"create în ultimile {{count}} zile"},"after_n_weeks":{"one":"create în ultima săptamană","other":"create în ultimile {{count}} săptămâni"}},"auto_track_topics":"Urmăriţi automat discuţii la care aţi participat","auto_track_options":{"never":"niciodată","always":"întotdeauna","after_n_seconds":{"one":"după o secundă","other":"după {{count}} secunde"},"after_n_minutes":{"one":"după un minut","other":"după {{count}} minute"}},"invited":{"search":"Scrie pentru a căuta invitaţii...","title":"Invitaţii","user":"Utilizatori invitaţi","none":"Nu ai invitat înca pe nimeni.","truncated":"Afişeaza primele {{count}} invitaţii.","redeemed":"Invitaţii rascumpărate","redeemed_at":"Răscumpărate","pending":"Invitaţii in aşteptare","topics_entered":"Subiecte văzute","posts_read_count":"Posturi citite","expired":"Această invitaţie a expirat.","rescind":"Anulează","rescinded":"Invitaţie anulată","time_read":"Timp de citit","days_visited":"Zile de vizită","account_age_days":"Vârsta contului în zile","create":"Trimite o invitaţie","bulk_invite":{"none":"Nu ai invitat încă pe nimeni. Poţi trimite invitaţii individuale, sau mai multor oameni deodată prin \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003e incărcarea fişierului de invitaţie multiplă\u003c/a\u003e.","text":"Invitaţie multiplă din fişierul","uploading":"Incarcă","success":"Fişier încărcat cu succes, veţi fi înştiinţat în scurt timp despre progres.","error":"S-a întâmpinat o eroare la încărcarea fişierului '{{filename}}': {{message}}"}},"password":{"title":"Parolă","too_short":"Parola este prea scurtă.","common":"Această parolă este prea comună.","ok":"Parola dumneavoastră arată bine.","instructions":"Trebuiesc minim %{count} de caractere."},"ip_address":{"title":"Ultima adresă de IP"},"registration_ip_address":{"title":"Înregistrarea adresei de IP"},"avatar":{"title":"Avatar"},"title":{"title":"Titlu"},"filters":{"all":"Toate"},"stream":{"posted_by":"Postat de","sent_by":"Trimis de","private_message":"Mesaj privat","the_topic":"Subiectul"}},"loading":"Încarcă...","errors":{"prev_page":"în timp ce încarcă","reasons":{"network":"Eroare de reţea","server":"Eroare de server: {{code}}","unknown":"Eroare"},"desc":{"network":"Verificaţi conexiunea.","network_fixed":"Se pare ca şi-a revenit.","server":"Ceva nu a funcţionat.","unknown":"Ceva nu a funcţionat."},"buttons":{"back":"Înapoi","again":"Încearcă din nou","fixed":"Încarcare pagină"}},"close":"Închide","assets_changed_confirm":"Acest site tocmai a fost updatat. Reîmprospătaţi pentru cea mai nouă versiune?","read_only_mode":{"enabled":"Un administrator v-a activat modul doar pentru citit. Puteţi rămâne pe site dar interacţiunile nu vor funcţiona.","login_disabled":"Autentificarea este dezactivată când siteul este în modul doar pentru citit."},"too_few_topics_notice":"Creaţi cel puţin 5 subiecte publice şi %{posts} de posturi publice pentru a putea începe discuţia. Noii membri nu vor putea obţine nivel de încredere decât dacă există şi pentru aceştia material de citit.","learn_more":"află mai multe...","year":"an","year_desc":"discuţii create în ultimile 365 de zile","month":"lună","month_desc":"discuţii create în ultimile 30 de zile","week":"săptămană","week_desc":"discuţii create în ultimile 7 zile","day":"zi","first_post":"Prima Postare","mute":"Anulare","unmute":"Activare","last_post_lowercase":"Ultima Postare","summary":{"enabled_description":"Vizualizaţi sumarul discuţiei: cea mai interesantă postare, aşa cum a fost determinată de comunitate. Pentru toate postările, faceţi click dedesubt.","description":"Există \u003cb\u003e{{count}}\u003c/b\u003e de răspunsuri.","description_time":"Există \u003cb\u003e{{count}}\u003c/b\u003e de răspunsuri cu timp de citit estimat la \u003cb\u003e{{readingTime}} de minute\u003c/b\u003e.","enable":"Fă sumarul discuţiei","disable":"Arată toate postările"},"deleted_filter":{"enabled_description":"Această discuţie conţine postări şterse, ce au fost ascunse. ","disabled_description":"Postările şterse din discuţie sunt vizibile.","enable":"Ascunde postările şterse","disable":"Arată postările şterse"},"private_message_info":{"title":"Mesaj privat","invite":"Invită alte persoane...","remove_allowed_user":"Chiar doriţi să îl eliminaţi pe {{name}} din acest mesaj privat?"},"email":"Email","username":"Nume utilizator","last_seen":"Văzut","created":"Creat","created_lowercase":"creat","trust_level":"Nivel de încredere","search_hint":"Numele de utilizator sau email","create_account":{"title":"Crează cont","failed":"Ceva a decurs greşit, poate că acest email e deja înregistrat, încearcă linkul parolă uitată "},"forgot_password":{"title":"Parolă uitată","action":"Mi-am uitat parola","invite":"Introduce-ţi numele de utilizator sau adresa de email şi vă vom trimite un email pentru resetarea parolei.","reset":"Resetare Parolă","complete_username":"Dacă contul se potriveşte numelui de utilizator \u003cb\u003e%{username}\u003c/b\u003e, ar trebuii să primiţi un email cu instrucţiunile de resetare a parolei, în scurt timp.","complete_email":"dacă un cont se potriveşte \u003cb\u003e%{email}\u003c/b\u003e, ar trebuii să primiţi un email cu instrucţiunile de resetare a parolei, în scurt timp."},"login":{"title":"Autentificare","username":"Utilizator","password":"Parolă","email_placeholder":"email sau nume de utilizator","caps_lock_warning":"Caps Lock este apăsat","error":"Eroare necunoscută","blank_username_or_password":"Introduceţi emailul sau numele de utilizator şi parola.","reset_password":"Resetare parolă","logging_in":"În curs de autentificare...","or":"sau","authenticating":"Se autentifică...","awaiting_confirmation":"Contul dumneavoastră aşteaptă să fie activat .Folosiţi linkul de reamintire a parolei, pentru a iniţia un alt email de activare.","awaiting_approval":"Contul dumneavoastră nu a fost aprobat încă de un admin . Veţi primi un email când se aprobă.","requires_invite":"Ne pare rău, accesul la forum se face pe bază de invitaţie.","not_activated":"Nu te poţi loga încă. Am trimis anterior un email de activare pentru \u003cb\u003e{{sentTo}}\u003c/b\u003e. Urmăriţi instrucţiunile din email pentru a vă activa contul.","resend_activation_email":"Click aici pentru a trimite emailul de activare încă odată.","sent_activation_email_again":"Am trimis un alt email de activare pentru dvs la \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Poate dura câteva minute până ajunge; Vizitaţi şi secţiunea de spam a mailului.","google":{"title":"cu Google","message":"Autentificare cu Google (Asiguraţi-vă că barierele de pop up nu sunt active)"},"google_oauth2":{"title":"cu Google","message":"Autentificare cu Google (Asiguraţi-vă că barierele de pop up nu sunt active)"},"twitter":{"title":"cu Twitter","message":"Autentificare cu Twitter (Asiguraţi-vă că barierele de pop up nu sunt active)"},"facebook":{"title":"cu Facebook","message":"Autentificare cu Facebook (Asiguraţi-vă că barierele de pop up nu sunt active)"},"yahoo":{"title":"cu Yahoo","message":"Autentificare cu Yahoo (Asiguraţi-vă că barierele de pop up nu sunt active)"},"github":{"title":"cu GitHub","message":"Autentificare cu GitHub (Asiguraţi-vă că barierele de pop up nu sunt active)"}},"composer":{"posting_not_on_topic":"Cărei discuţii vrei să-i răspunzi?","saving_draft_tip":"Salvează","saved_draft_tip":"salvat","saved_local_draft_tip":"salvat local","similar_topics":"discuţia dvs e similară cu...","drafts_offline":"proiecte offline","min_length":{"need_more_for_title":"{{n}} pentru a merge la titlu","need_more_for_reply":"{{n}} pentru a merge la postare"},"error":{"title_missing":"Este nevoie de titlu","title_too_short":"Titlul trebuie sa aibă minim {{min}} de caractere","title_too_long":"Titlul nu poate avea {{max}} de caractere","post_missing":"Postarea nu poate fi gol","post_length":"Postarea trebuie sa aibă minim {{min}} de caractere","category_missing":"Trebuie să alegi o categorie"},"save_edit":"Salvează Editarea","reply_original":"Răspunde discuţiei originale","reply_here":"Răspunde aici","reply":"Răspunde","cancel":"Anulează","create_topic":"Crează discuţie","create_pm":"Crează mesaj privat","title":"sau apasă Ctrl+Enter","users_placeholder":"adaugă un utilizator","title_placeholder":"Care este tema discuţiei într-o singură propoziţie?","edit_reason_placeholder":"de ce editaţi?","show_edit_reason":"(adaugă motivul editării)","reply_placeholder":"Scrie aici. Foloseşte Markdown sau BBCode pentru format. Trage sau lipeşte o imagine ca să o încarci.","view_new_post":"Vizualizează noua postare.","saving":"Salvează...","saved":"Salvat!","saved_draft":"Ai o postare în stadiul neterminat. Fă click oriunde pentru a continua editarea.","uploading":"Încarcă...","show_preview":"arată previzualizare \u0026raquo;","hide_preview":"\u0026laquo; ascunde previzualizare","quote_post_title":"Citează întreaga postare","bold_title":"Gros","bold_text":"text gros","italic_title":"Aplecare","italic_text":"text aplecat","link_title":"Adresă Hyper","link_description":"adaugă aici descrierea adresei hyper","link_dialog_title":"Introdu adresă hyper","link_optional_text":"titlu opţional","quote_title":"Citat-bloc","quote_text":"Citat-bloc","code_title":"Text preformatat","code_text":"indentează preformatarea textului cu 4 spaţii","upload_title":"Încarcă","upload_description":"Introduceţi aici descrierea fişierelor încărcate","olist_title":"Listă numerică","ulist_title":"Listă punctată","list_item":"conţinut de listă","heading_title":"Titlu","heading_text":"Titlu","hr_title":"Regulă de ordonare orizontală","undo_title":"Anulează schimbările","redo_title":"Refă schimbările","help":"Ajutor de editare","toggler":"ascunde sau arată panelul de compus","admin_options_title":"Setări opţionale ale discuţiei pentru moderatori","auto_close_label":"Timpul de auto-închidere a discuţiei:","auto_close_units":"(# de ore, de timp, sau de cronometru)","auto_close_examples":"introduceţi timpul exact sau numărul de ore — 24, 17:00, 2013-11-22 14:00","auto_close_error":"Introduceţi o valoare validă."},"notifications":{"title":"notificări @nume menţiuni, răspunsuri la postări, discuţii, mesaje private, etc","none":"nu aveţi nicio notificare deocamdată.","more":"vezi notificările mai vechi","total_flagged":"toate postările semnalate","mentioned":"\u003ci title='a menţionat' class='icon'\u003e@\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='a citat' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='a răspuns' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='a răspuns' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='a editat' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='a apreciat' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","private_message":"\u003ci title='Mesaj privat' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='Mesaj privat' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='a acceptat invitaţia ta' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e a acceptat invitaţia ta\u003c/p\u003e","moved_post":"\u003ci title='postare mutată' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e mutată {{description}}\u003c/p\u003e","linked":"\u003ci title='adresă de postare' class='fa fa-arrow-left'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='insignă acordată' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003e Ţi s-a acordat {{description}}\u003c/p\u003e"},"upload_selector":{"title":"Adaugă o imagine","title_with_attachments":"adaugă o imagine sau un fişier","from_my_computer":"din dispozitivul meu","from_the_web":"De pe web","remote_tip":"adresă către imagine http://example.com/image.jpg","remote_tip_with_attachments":"adresă către imagine sau fişier http://example.com/file.ext (extensii permise: {{authorized_extensions}}).","local_tip":"click pentru a selecta o imagine din dispozitivul dvs","local_tip_with_attachments":"click pentru a selecta o imagine sau fişier din dispozitivul dvs (extensii permise: {{authorized_extensions}})","hint":"(puteţi să trageţi şi să aruncaţi în editor pentru a le încărca)","hint_for_supported_browsers":"(puteţi să trageţi şi să aruncaţi, sau să le lipiţi în editor pentru a le încărca)","uploading":"Încarcă","image_link":"Adresa din imagine va duce la"},"search":{"title":"caută discuţii ,postări sau categorii","no_results":"Fără rezultat.","searching":"Caută...","context":{"user":"Caută postări după @{{username}}","category":"Caută în categoria\"{{category}}\" ","topic":"Caută în această discuţie"}},"site_map":"mergi la o altă listă de discuţii sau categorii","go_back":"înapoi","not_logged_in_user":"pagina utilizatorului cu sumarul activităţilor şi preferinţelor","current_user":"mergi la pagina proprie de utilizator","starred":{"title":"Participare","help":{"star":"adaugă această discuţie la lista de participări","unstar":"şterge acestă discuţie din lista de participări"}},"topics":{"bulk":{"reset_read":"resetează citirea","dismiss_posts":"Şterge postarea","dismiss_posts_tooltip":"Şterge părţile necitite din această discuţie dar continuă afişarea lor în lista de necitite când au loc postări noi","dismiss_topics":"Sterge discuţia","dismiss_topics_tooltip":"Nu arăta aceste discuţii în lista de necitite când au loc postări noi","dismiss_new":"Anulează cele noi","toggle":"activează selecţia în masă pentru discuţii","actions":"Acţiuni în masă","change_category":"Schimbă categoria","close_topics":"Închide discuţiile","notification_level":"Schimbă nivelul de notificări","selected":{"one":"Ai selectat \u003cb\u003eo\u003c/b\u003e discuţie.","other":"Ai selectat \u003cb\u003e{{count}}\u003c/b\u003e de discuţii."}},"none":{"starred":"Nu ai participat încă la nicio discuţie. Pentru a participa, fă click pe steluţa de langă titlu.","unread":"Nu aveţi discuţii necitite.","new":"Nu aveţi discuţii noi.","read":"Nu aţi citit nicio discuţie încă.","posted":"Nu aţi postat în nicio discuţie încă.","latest":"Nu există nicio discuţie nouă. Trist.","hot":"Nu există nicio discuţie importantă.","category":"Nu există nicio discuţie din categoria {{category}}.","top":"Nu exită nicio discuţie de top."},"bottom":{"latest":"Nu există nicio ultimă discuţie.","hot":"Nu mai există discuţii importante.","posted":"Nu mai există discuţii postate.","read":"Nu mai există discuţii citite.","new":"Nu mai există discuţii noi.","unread":"Nu mai există discuţii necitite.","starred":"Nu mai există discuţii de participare.","category":"Nu mai există discuţii din categoria {{category}}.","top":"Nu mai există discuţii de top."}},"topic":{"filter_to":"{{post_count}} de postări în discuţie","create":"Crează discuţie","create_long":"Crează discuţie nouă","private_message":"Scrie un mesaj privat","list":"Discuţii","new":"discuţie nouă","unread":"necitită","new_topics":{"one":"o nouă discuţie","other":"{{count}} de discuţii noi"},"unread_topics":{"one":"O discuţie necitită","other":"{{count}} de discuţii necitite"},"title":"Discuţie","loading_more":"Încarc mai multe discuţii...","loading":"Încarc discuţie...","invalid_access":{"title":"Discuţie pirvată","description":"Ne pare rău nu ai acces la acea discuţie!","login_required":"Trebuie să fii autentificat să poţi vedea discuţia."},"server_error":{"title":"Discuţia nu s-a putut încărca","description":"Ne pare rău, nu am putut încărca discuţia, posibil din cauza unei probleme de conexiune. Încercaţi din nou. Dacă problema persistă, anunţaţi-ne."},"not_found":{"title":"Discuţie negăsită","description":"Ne pare rău, Nu am putut găsii discuţia. Poate a fost ştearsă de un moderator?"},"total_unread_posts":{"one":"aveţi o postare necitită în această discuţie","other":"aveţi {{count}} de postări neicitite în această discuţie"},"unread_posts":{"one":"aveţi o postare veche necitită în această discuţie","other":"aveţi {{count}} de postări necitite în această discuţie"},"new_posts":{"one":"Există un post nou în această discuţie de când aţi citit ultima oară","other":"Există {{count}} de postări noi în această discuţie de când aţi citit-o ultima oară"},"likes":{"one":"există o apreciere în această discuţie","other":"sunt {{count}} de aprecieri în această discuţie"},"back_to_list":"Înapoi la lista de discuţii","options":"Opţiunile discuţiei","show_links":"arată adresele din această discuţie","toggle_information":"activează detaliile discuţiei","read_more_in_category":"Vreţi să citiţi mai mult? Priviţi alte discuţii din {{catLink}} sau {{latestLink}}.","read_more":"Vreţi să citiţi mai mult? {{catLink}} sau {{latestLink}}.","browse_all_categories":"Priviţi toate categoriile","view_latest_topics":"priviţi ultimele discuţii","suggest_create_topic":"De ce să nu creaţi o discuţie?","read_position_reset":"Poziţia de citit a fost resetată.","jump_reply_up":"răspundeţi imediat","jump_reply_down":"răspundeţi mai târziu","deleted":"Discuţia a fost ştearsă","auto_close_notice":"Această discuţie va fi inchisă în %{timeLeft}.","auto_close_title":"Setările de auto-închidere","auto_close_save":"Salvează","auto_close_remove":"nu închide automat această discuţie","progress":{"title":"Progresul Discuţiei","go_top":"capăt","go_bottom":"sfârşit","go":"mergi","jump_bottom_with_number":"sări la postarea %{post_number}","total":"toate postările","current":"Postarea curentă","position":"postarea %{current} din %{total}"},"notifications":{"reasons":{"3_6":"Veţi primii notificări fiindcă priviţi această categorie.","3_5":"Veţi primii notificări fiindcă aţi început să citiţi această discuţie automat.","3_2":"Veţi primii notificări fiindcă citiţi această discuţie.","3_1":"Veţi primii notificări fiindcă aţi creat această discuţie.","3":"Veţi primii notificări fiindcă priviţi această discuţie.","2_8":"Veţi primii notificări fiindcă urmariţi această categorie.","2_4":"Veţi primii notificări fiindcă aţi postat un răspuns în această discuţie.","2_2":"Veţi primii notificări fiindcă urmariţi această discuţie.","2":"Veţi primii notificări fiindcă  citiţi \u003ca href=\"/users/{{username}}/preferences\"\u003eaceastă discuţie\u003c/a\u003e.","1_2":"Veţi primii notificare dacă cineva vă menţionează @numele sau răspunde la postarea dvs.","1":"Veţi primii notificare dacă cineva vă menţionează @numele sau răspunde la postarea dvs.","0_7":"Ignoraţi toate notificările din această categorie.","0_2":"Ignoraţi toate notificările din această discuţie.","0":"Ignoraţi toate notificările din această discuţie."},"watching_pm":{"title":"Privind","description":"Veţi fi notificat de fiecare postare în acest mesaj privat.Numărul de postări necitite va apărea lânga lista discuţiei."},"watching":{"title":"Privind","description":"Veţi fi notificat de fiecare postare nouă din această discuţie. Numărul de postări noi necitite va apărea lânga lista discuţiei.."},"tracking_pm":{"title":"Urmărind","description":"Numărul postărilor noi şi necitite va apărea langă mesajul privat. Veţi fi notificat doar dacă cineva vă menţionează @numele sau răspunde la postare."},"tracking":{"title":"Urmărind","description":"Numărul postărilor noi şi necitite va apărea langă lista de discuţii. Veţi fi notificat doar dacă cineva vă menţionează @numele sau răspunde la postare "},"regular":{"title":"Normal","description":"Veţi fi notificat doar dacă cineva vă menţionează @numele sau răspunde la postare"},"regular_pm":{"title":"Normal","description":"Veţi fi notificat doar dacă cineva vă menţionează @numele sau răspunde la postare în mesajul privat."},"muted_pm":{"title":"Silenţios","description":"Nu veţi fi notificat de nimic în legătură cu acest mesaj privat."},"muted":{"title":"Silenţios","description":"Nu veţi fi notificat de nimic în legătură cu această dicuţie, nu va apărea în tabul necitite."}},"actions":{"recover":"Rescrie discuţie","delete":"Şterge Discuţie","open":"Deschide discuţie","close":"Închide discuţie","auto_close":"Închide automat","make_banner":"Marchează discuţie","remove_banner":"Demarchează discuţie","unpin":"Anulează fixarea discuţiei","pin":"Fixează discuţie","pin_globally":"Fixează global discuţia","unarchive":"Dezarhivează discuţia","archive":"Arhivează discuţia","invisible":"Fă invizibil","visible":"Fă vizibil","reset_read":"Resetează informaţia citită","multi_select":"Selectează discuţia"},"reply":{"title":"Răspunde","help":"începe să compui un răspuns pentru această discuţie"},"clear_pin":{"title":"Înlătură fixarea","help":"Înlătură statutul de fix al acestei discuţii pentru a nu mai apărea în vârful listei de discuţii"},"share":{"title":"Distribuie","help":"distribuie o adresă acestei discuţii"},"flag_topic":{"title":"Marcheză","help":"marchează privat această discuţie pentru atenţie sau trimite o notificare privată despre ea","success_message":"Ai marcat cu succes această discuţie."},"inviting":"Invită...","automatically_add_to_groups_optional":"Aceasta invitaţie include şi accesul la grupurile: (opţional, doar admin)","automatically_add_to_groups_required":"Aceasta invitaţie include şi accesul la grupurile: (\u003cb\u003eNeapărat\u003c/b\u003e, doar admin)","invite_private":{"title":"Invită la mesaj privat","email_or_username":"adresa de Email sau numele de utilizator al invitatului","email_or_username_placeholder":"adresa de email sau numele utilizatorului","action":"Invită","success":"Am invitat acest utilizator să participe la acest mesaj privat.","error":"Ne pare rău, s-a întâmpinat o eroare la trimiterea invitaţiei către acel utilizator.","group_name":"numele grupului"},"invite_reply":{"title":"Invitaţie","action":"Invitaţie prin Email","help":"trimite invitaţie prietenilor pt a putea participa la această discuţie printr-un singur click","to_topic":"Vom trimite un email scurt permiţând prietenilor dumneavoastră să participe şi să răspundă la această dicuţie făcând click pe o adesă, nu necesită autentificare.","to_forum":"Vom trimite un email scurt permiţând prietenilor dumneavoastră să participe făcând click pe o adesă, nu necesită autentificare.","email_placeholder":"exemplu@nume.com","success":"Am trimis prin Email invitaţii către \u003cb\u003e{{email}}\u003c/b\u003e. Vă vom notifica momentul primirii. Verifică tabul de invitaţii din pagina de utilizator pentru a supraveghea invitaţiile.","error":"Ne pare rău, nu am putut să invităm pesoana în cauză. Poate există deja ca utilizator?"},"login_reply":"Autentifică-te pentru a răspunde.","filters":{"n_posts":{"one":"o postare","other":"{{count}} postări"},"cancel":"Arată din nou toate postările din această discuţie."},"split_topic":{"title":"Mutare în discuţie nouă ","action":"mută în discuţie nouă","topic_name":"Numele noii discuţii","error":"S-a semnalat o eroare la mutarea postărilor către discuţia nouă.","instructions":{"one":"Eşti pe cale de a crea o discuţie nouă şi de a o umple cu postările selectate.","other":"Eşti pe cale de a crea o discuţie nouă şi de a o umple cu \u003cb\u003e{{count}}\u003c/b\u003e de postări selectate."}},"merge_topic":{"title":"Mută în discuţie existentă","action":"mută în discuţie existentă","error":"S-a semnalat o eroare la mutarea postărilor în acea discuţie.","instructions":{"one":"Te rugăm alege discuţia în care vrei să muţi postarea.","other":"Te rugăm alege discuţia în care vrei să muţi cele \u003cb\u003e{{count}}\u003c/b\u003e de postări."}},"change_owner":{"title":"Schimbă deţinătorul postărilor","action":"Schimbă apartenenţa","error":"S-a semnalat o eroare la schimbarea apartenenţei postărilor.","label":"Noul deţinător al postărilor","placeholder":"numele de utilizator al deţinătorului","instructions":{"one":"Alege-ţi noul detinator al postarii după \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Alege-ţi noul deţinator al celor {{count}} de postări după \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":" aveți în vedere că nicio notificare ce privește această postare nu va fi transferabilă retroactiv către noul utilizator.\u003cbr\u003eAvertisment: Acum, nicio informaţie ce depinde de postare nu va fi transferată noului utilizator. Folosiţi cu grijă."},"multi_select":{"select":"selectează","selected":"selectate ({{count}})","select_replies":"selectează +răspunsuri","delete":"şterge selecţia","cancel":"anularea selecţiei","select_all":"selectează tot","deselect_all":"deselectează  tot","description":{"one":"Aţi selectat \u003cb\u003eo\u003c/b\u003e postare.","other":"Aţi selectat \u003cb\u003e{{count}}\u003c/b\u003e de postări."}}},"post":{"reply":"Răspunde la {{link}} prin {{replyAvatar}} {{username}}","reply_topic":"Răspunde la {{link}}","quote_reply":"răspunde prin citat","edit":"Editează {{link}} prin {{replyAvatar}} {{username}}","edit_reason":"Motivul: ","post_number":"postarea {{number}}","in_reply_to":"răspunde lui","last_edited_on":"postare editată ultima oară la","reply_as_new_topic":"Răspunde cu o discuţie nouă","continue_discussion":"Continuă discuţia de la {{postLink}}:","follow_quote":"mergi la postarea citată","show_full":"Arată postarea în întregime","show_hidden":"Arată conţinut ascuns.","deleted_by_author":{"one":"(post retras de către autor, va fi automat şters în %{count} de ore numai dacă nu este marcat)","other":"(post retras de către autor, va fi automat şters în %{count} de ore numai dacă nu este marcat)"},"expand_collapse":"expandează/restrânge","gap":{"one":"o postare ascunsă","other":"{{count}} postări ascunse"},"more_links":"{{count}} mai multe...","unread":"postarea nu a fost citită","has_replies":{"one":"Răspuns","other":"Răspunsuri"},"errors":{"create":"Ne pare rău , s-a semnalat o eroare în creerea postării dumneavoastră.Vă rugăm încercati iar.","edit":"Ne pare rău , s-a semnalat o eroare în editarea postării dumneavoastră . Vă rugăm încercati iar.","upload":"Ne pare rău ,s-a semnalat o eroare în încarcarea acelui fişier. Vă rugăm încercati iar.","attachment_too_large":"Ne pare rău, fişierul pe care-l încarcaţi este prea mare (marimea maximă este de {{max_size_kb}}kb).","image_too_large":"Ne pare rău, imaginea pe care o încarcaţi este prea mare (marimea maximă este de {{max_size_kb}}kb), redimensionaţi şi încercaţi iar.","too_many_uploads":"Ne pare rău, puteţi încarca doar cate un fişier.","upload_not_authorized":"Ne pare rău, fişierul pe care-l încarcaţi nu este autorizat (extensia pentru autorizare: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Ne pare rău, noul utilizator nu poate încarca imagini.","attachment_upload_not_allowed_for_new_user":"Ne pare rău, noul utilizator nu poate încarca ataşamnete."},"abandon":{"confirm":"Sunteţi sigur că doriţi să abandonaţi postarea?","no_value":"Nu, pastrează","yes_value":"Da, abandonează"},"wiki":{"about":"Acest post este un wiki; oricine poate edita"},"archetypes":{"save":"Opţiuni de salvare"},"controls":{"reply":"începe compunerea unui răspuns pentru această postare","like":"apreciează acestă postăre","has_liked":"ai retras aprecierea acestei postări ","undo_like":"anuleazaă aprecierea","edit":"editează această postare","flag":"marchează privat această postare pentru atenţie sau trimite o notificare privată despre aceasta","delete":"şterge această postare","undelete":"rescrie această postare","share":"distribuie adresa către această postare","more":"Mai mult","delete_replies":{"confirm":{"one":"Doriţi să şetergeţi şi răspunsul direct către această discuţie?","other":"Doriţi să ştergeţi şi cele {{count}} de  răspunsuri directe către această discuţie?"},"yes_value":"Da, şterge şi răspunsurile","no_value":"Nu, doar postarea"},"admin":"acţiuni administrative de postare","wiki":"Fă postarea Wiki","unwiki":"Anulează stadiul de wiki al postării"},"actions":{"flag":"Semnal","defer_flags":{"one":"Amână semnalarea","other":"Amână semnalarile"},"it_too":{"off_topic":"Şi semnalează","spam":"Şi semnalează","inappropriate":"Şi semnalează","custom_flag":"Şi semnalează","bookmark":"şi marchează","like":"Şi acordă-i apreciere ","vote":"Şi votează pentru"},"undo":{"off_topic":"Retrage semnalare","spam":"Retrage semnalare","inappropriate":"Retrage semnalare","bookmark":"Retrage marcare","like":"Retrage apreciere","vote":"Retrage vot"},"people":{"off_topic":"{{icons}} Semnalază asta ca în afara discuţiei","spam":"{{icons}} Semnalează asta ca spam","inappropriate":"{{icons}} Semnalează asta ca necorespunzator","notify_moderators":"{{icons}} moderatorii notificaţi","notify_moderators_with_url":"{{icons}} \u003ca href='{{postUrl}}'\u003e moderatori notificaţi\u003c/a\u003e","notify_user":"{{icons}} trimite un mesaj privat","notify_user_with_url":"{{icons}} trimite \u003ca href='{{postUrl}}'\u003eca mesaj privat\u003c/a\u003e","bookmark":"{{icons}} marchează asta","like":"{{icons}} apreciat","vote":"{{icons}} votat"},"by_you":{"off_topic":"Aţi marcat ca fiind în afara discutiei","spam":"Aţi marcat ca fiind spam","inappropriate":"Aţi marcat ca necorespunzator","notify_moderators":"Aţi marcat pentru a fi moderată","notify_user":"Aţi trimis un mesaj privat catre acest utilizator","bookmark":"Aţi marcat ca semn de carte această postare","like":"Aţi apreciat","vote":"Aţi votat aceasta postare"},"by_you_and_others":{"off_topic":{"one":"Dvs şi înca o persoană aţi marcat ca fiind în afara discutiei","other":"Dvs şi încă {{count}} de persoane aţi marcat ca fiind în afara discuţiei"},"spam":{"one":"Dvs şi înca o persoană aţi marcat ca fiind Spam","other":"Dvs si încă {{count}} de persoane aţi marcat ca fiind spam"},"inappropriate":{"one":"Dvs şi înca o persoană aţi marcat ca fiind necorespunzator","other":"Dvs şi înca {{count}} de persoane aţi marcat ca fiind necorespunzator"},"notify_moderators":{"one":"Dvs şi înca o persoană aţi marcat pentru a fi remoderată","other":"Dvs şi incă {{count}} de persoane aţi marcat pentru a fi remoderată"},"notify_user":{"one":"Dvs şi încă o persoană aţi trimis mesaj privat acestui utilizator","other":"Dvs şi încă {{count}} de persoane au trimis mesaj privat acestui utilizator"},"bookmark":{"one":"Dvs şi 1 alt utilizator aţi adăugat postarea la semne de carte","other":"Dvs şi înca {{count}} de persoane au adăugat postarea la semne de carte"},"like":{"one":"Dvs şi încă o altă persoană aţi apreciat","other":"Dvs şi încă {{count}} de persoane aţi apreciat"},"vote":{"one":"Dvs şi înca o alta persoana aţi votat aceasta postare","other":"Dvs şi înca {{count}} de persoane au votat aceasta postare"}},"by_others":{"off_topic":{"one":"o persoană a marcat ca fiind în afara discuţiei","other":"{{count}} de persoane au marcat ca fiind în afara discuţiei"},"spam":{"one":"o persoană a marcat ca spam","other":"{{count}} de persoane au marcat ca spam"},"inappropriate":{"one":"o persoană a marcat ca fiind necorespunzatoare","other":"{{count}} de persoane au marcat ca necorespunzator"},"notify_moderators":{"one":"o persoană a marcat pentru a fi remoderată","other":"{{count}} de persoane au marcat pentru a fi remoderată"},"notify_user":{"one":"o persoană a trimis un mesaj privat acestui utilizator","other":"{{count}} de persoane au trimis mesaj privat acestui utilizator"},"bookmark":{"one":"o persoană a adugat postarea la semne de carte","other":"{{count}} de persoane au adaugat postarea la semne de carte"},"like":{"one":"o persoană a apreciat","other":"{{count}} de persoane au apreciat"},"vote":{"one":"o persoană a votat pentru","other":"{{count}} de persoane au votat pentru această postare"}}},"edits":{"one":"o editare","other":"{{count}} editari","zero":"nicio editare"},"delete":{"confirm":{"one":"Sunteţi sigur că doriţi să ştergeţi acea postare?","other":"Sunteţi sigur că doriţi să ştergeţi toate aceste postări?"}},"revisions":{"controls":{"first":"Prima revizie","previous":"Revizie precedentă","next":"Urmatoarea revizie","last":"Ultima revizie","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e vs \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Arată rezultatul randării cu adăugări şi proprietăţi","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Arată proprietăţile rezultatului randării una lângă alta","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Arată sursa de marcare a proprietăţilor una lângă alta","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Markdown"}},"details":{"edited_by":"Editat de"}}},"category":{"can":"can\u0026hellip; ","none":"(nicio categorie)","choose":"Selectează o categorie\u0026hellip;","edit":"editează","edit_long":"Editează","view":"Arată discuţiile în categorie","general":"General","settings":"Setări","delete":"Şterge categorie","create":"Crează categorie","save":"Salvează categorie","creation_error":"S-a semnalat o eroare în timpul creării categoriei.","save_error":"S-a semnalat o eroare in timpul salvării categoriei.","more_posts":"Arata toate {{posts}}...","name":"Numele categoriei","description":"Descriere","topic":"Topicul categoriei","logo":"Imaginea Logo a categoriei","background_image":"Imaginea de fundal a categoriei","badge_colors":"Culorile insignei","background_color":"Culoarea de fundal","foreground_color":"Culoarea de prim-plan","name_placeholder":"Unul sau doua cuvinte maximum","color_placeholder":"Orice culoare","delete_confirm":"Sigur doriţi să ştergeţi această categorie?","delete_error":"S-a semnalat o eroare la ştergerea acestei categorii.","list":"Lista categorii","no_description":"Va rugăm adăugaţi o descriere acestei categorii.","change_in_category_topic":"Editează descrierea","already_used":"Această culoare este folosită la o altă categorie","security":"Securitate","images":"Imagini","auto_close_label":"Auto-inchide discuţiile după:","auto_close_units":"ore","email_in":"Adresa email de primire preferenţială:","email_in_allow_strangers":"Acceptă emailuri de la utilizatori anonimi fară cont","email_in_disabled":"Postarea discuţiilor noi prin email este dezactivată din setările siteului. Pentru a activa postarea discuţiilor noi prin email,","email_in_disabled_click":"activarea setării \"primire email \".","allow_badges_label":"Permite acordarea de insigne în această categorie","edit_permissions":"Editează Permisiuni","add_permission":"Adaugă Permisiune","this_year":"anul acesta","position":"poziţie","default_position":"Poziţie iniţială","position_disabled":"Categoriile vor fi afişate în ordinea activitaţii. Pentru a controla ordinea categoriilor în listă, ","position_disabled_click":"activeaza setarea \"poziţia fixa a categoriei\".","parent":"Categoria parinte","notifications":{"title":"","reasons":null,"watching":{"title":"Vizualizare","description":"Veţi vizualiza automat toate discuţiile noi din aceste categorii. Veţi fi notificat cu privire la toate postările şi discuţiile noi, plus numarul de postări necitite va fi afişat langă listarea discuţiilor."},"tracking":{"title":"Urmărire","description":"Veţi urmării automat toate discuţiile noi din aceste categorii. Numărul postărilor necitite va fi afişat langă listarea discuţiilor."},"regular":{"title":"Normal","description":"Veţi fi notificat dacă cineva va menţioneaza @numele sau răspunde postărilor dvs."},"muted":{"title":"Silenţios","description":"Nu veţi fi niotificat de discuţiile noi din aceste categorii, ele nu vor apărea în tabul necitite."}}},"flagging":{"title":"De ce marcaţi această postare ca fiind privată?","action":"Marcare","take_action":"Actionează","notify_action":"Mesaj privat","delete_spammer":"Şterge spammer","delete_confirm":"Sunteţi pe punctul de a şterge postarea \u003cb\u003e%{posts}\u003c/b\u003e şi postările \u003cb\u003e%{topics}\u003c/b\u003e ale acestui uitilizator, de a-i anula contul, de a-i bloca autentificarea de la adresa IP \u003cb\u003e%{ip_address}\u003c/b\u003e, adresa de email \u003cb\u003e%{email}\u003c/b\u003e şi de a bloca listarea permanent. Sunteţi sigur ca acest utilizator este un spammer?","yes_delete_spammer":"Da, Şterge spammer","submit_tooltip":"Acceptă marcarea privată","take_action_tooltip":"Accesati permisiunea marcarii imediat, nu mai asteptati alte marcaje comune","cant":"Ne pare rău nu puteţi marca această postare deocamdată.","custom_placeholder_notify_user":"De ce această postare necesită comunicarea cu utilizatorul directă sau privată? Fiţi specific, constructiv şi intotdeauna amabil.","custom_placeholder_notify_moderators":"De ce această postare necesită atenţia moderatorului? Spuneţi-ne exact ceea ce vă nelamureşte, şi oferiţi adrese relevante de câte ori e posibil.","custom_message":{"at_least":"introduce-ţi cel puţin {{n}} de caractere","more":"încă...{{n}} caractere","left":"au mai rămas {{n}} caractere"}},"flagging_topic":{"title":"De ce marcaţi privat această discuţie?","action":"Marchează discuţie","notify_action":"Mesaj privat"},"topic_map":{"title":"Sumarul discuţiei","links_shown":"arată toate {{totalLinks}} de adrese...","clicks":{"one":"un click","other":"%{count} de clickuri"}},"topic_statuses":{"locked":{"help":"Această discuţie este închisă; nu mai acceptă răspunsuri noi"},"archived":{"help":"Această discuţie a fost arhivată; Este închetată şi nu poate fi editată"},"unpinned":{"title":"Desprinde","help":"Această discuţie a fost desprinsă; va fi afişată în ordinea iniţială"},"pinned_globally":{"title":"Fixată Global","help":"Această discuţie a fost fixată global; va fi afişată în capătul tuturor listelor"},"pinned":{"title":"Fixată","help":"Această discuţie a fost fixată; va fi afişată în vîrful propriei categorii"},"invisible":{"help":"Această discuţie este invizibilă; nu va fi afişată în listele de discuţii şi va fi accesată numai prin adresa directă"}},"posts":"Postări","posts_lowercase":"postări","posts_long":"sunt {{number}} de postări în această discuţie","original_post":"Postări originale","views":"Vizualizări","views_lowercase":"vizualizări","replies":"Răspunsuri","views_long":"această discuţie a fost vizualizată de {{number}} de ori","activity":"Activitate","likes":"Aprecieri","likes_lowercase":"aprecieri","likes_long":"sunt {{number}} de aprecieri în această discuţie","users":"Utilizatori","users_lowercase":"utilizatori","category_title":"Categorie","history":"Istoric","changed_by":"de {{author}}","categories_list":"Listă categorii","filters":{"with_topics":"%{filter} Discuţii","with_category":"%{filter} %{category} discuţii","latest":{"title":"Ultimele","help":"Discuţii cu postări recente"},"hot":{"title":"Interesant","help":"o selecţie a discuţiilor interesante"},"starred":{"title":"Participare","help":"discuţii la care ai participat"},"read":{"title":"Citite","help":"Discuţii citite, în ordinea cronologică a citirii"},"categories":{"title":"Categorii","title_in":"Categoria - {{categoryName}}","help":"toate discuţiile grupate pe categorii"},"unread":{"title":{"zero":"Necitite","one":"(1) necitită","other":"({{count}}) necitite"},"help":"discuţiile pe care le vizualizaţi sau urmariţi momentan ce includ postări necitite","lower_title_with_count":{"zero":"","one":"1 necitită","other":"{{count}} necitite"}},"new":{"lower_title_with_count":{"zero":"","one":"o nouă","other":"{{count}} noi"},"lower_title":"noi","title":{"zero":"Noi","one":"o nouă","other":"({{count}}) noi"},"help":"discuţii create în ultimele zile"},"posted":{"title":"Postările mele","help":"discuţii în care aţi postat"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"discuţiile recente din categoria {{categoryName}}"},"top":{"title":"Top","help":"o selecţie a celor mai bune discuţii din ultimul an, lună sau zi","yearly":{"title":"Top anual"},"monthly":{"title":"Top lunar"},"weekly":{"title":"Top săptămânal"},"daily":{"title":"Top zilnic"},"this_year":"Anul acesta","this_month":"Luna aceasta","this_week":"Săptămâna aceasta","today":"Astăzi","other_periods":"vezi mai multe discuţii"}},"browser_update":"Din nefericire, \u003ca href=\"http://www.discourse.org/faq/#browser\"\u003e browserul dumneavoastră este prea vechi pentru a funcţiona pe acest forum \u003c/a\u003e. Va rugăm \u003ca href=\"http://browsehappy.com\"\u003e reânoiţi browserul\u003c/a\u003e.","permission_types":{"full":"Crează / Răspunde / Vizualizează","create_post":"Răspunde / Vizualizaează","readonly":"Vizualizaează"},"type_to_filter":"tastează pentru a filtra...","admin":{"title":"Discurs Admin","moderator":"Moderator","dashboard":{"title":"Spaţiu de lucru","last_updated":"Actualizările spaţiului de lucru:","version":"Versiune","up_to_date":"Sunteţi la zi!","critical_available":"O actualizare importantă este valabilă.","updates_available":"Actualizări sunt disponibile.","please_upgrade":"Vă rugăm upgradaţi!","no_check_performed":"O căutare a actualizărilor nu a fost făcută. Asiguraţi-vă că sidekiq este pornit.","stale_data":"O căutare a actualizărilor nu a fost făcută în ultimul timp. Asiguraţi-vă că sidekiq este pornit.","version_check_pending":"Se pare că aţi actualizat recent. Fantastic!","installed_version":"Instalat","latest_version":"Ultima","problems_found":"Ceva probleme s-au întâmpinat la instalarea discursului:","last_checked":"Ultima dată verificat","refresh_problems":"Reîmprospătează","no_problems":"Nicio problemă semnalată.","moderators":"Moderatori:","admins":"Admini:","blocked":"Blocaţi:","suspended":"Suspendaţi:","private_messages_short":"MPs","private_messages_title":"Mesaje Private","reports":{"today":"astăzi","yesterday":"Ieri","last_7_days":"din ultimele 7 zile","last_30_days":"din ultimele 30 de zile","all_time":"Din totdeauna","7_days_ago":"Acum 7 zile","30_days_ago":"Acum 30 de zile","all":"Toate","view_table":"Arată ca tabel","view_chart":"Diagramă cu bare"}},"commits":{"latest_changes":"Ultimele schimbări: Vă rugăm reactualizaţi des!","by":"de către"},"flags":{"title":"Marcaje","old":"Vechi","active":"Active","agree":"De acord","agree_title":"Confirmă acest marcaj ca valid şi corect","agree_flag_modal_title":"De acord şi...","agree_flag_hide_post":"De acord (ascunde postarea + trimite MP)","agree_flag_hide_post_title":"Ascunde această postare şi trimite automat utilizatorului un mesaj privat cu somaţia de a o edita","agree_flag":"De acord cu marcarea","agree_flag_title":"De acord cu marcarea şi menţine postarea neschimbată","defer_flag":"Amânare","defer_flag_title":"Scoate marcajul; Nu necesită o acţiune deocamdată.","delete":"Ştergere","delete_title":"Şterge postarea la care face referinţa marcajul.","delete_post_defer_flag":"Şterge postarea şi renunţă la marcaj","delete_post_defer_flag_title":"Şterge postarea; dacă este prima, şterge discuţia","delete_post_agree_flag":"Şterge postarea şi aprobă marcajul","delete_post_agree_flag_title":"Şterge postarea; dacă este prima, sterge discuţia","delete_flag_modal_title":"Ştergere şi...","delete_spammer":"Ştergere Spammer","delete_spammer_title":"Şterge utilizatorul , postările şi discuţiile acestuia.","disagree_flag_unhide_post":"Nu sunt de acord (arată postarea)","disagree_flag_unhide_post_title":"Înlătură orice marcaj din postare şi fă postarea din nou vizibilă","disagree_flag":"Nu sunt de acord","disagree_flag_title":"Refuză marcaj, acesta fiind invalid sau incorect","clear_topic_flags":"Terminat","clear_topic_flags_title":"Discuţia a fost analizată iar problema rezolvată. Face-ţi click pe Terminat pentru a înlătura marcajul.","more":"(detalii...)","dispositions":{"agreed":"de acord","disagreed":"Nu sunt de acord","defered":"Amânat"},"flagged_by":"Marcat de către","resolved_by":"Resolvat de către","system":"Sistem","error":"Ceva a nu a funcţionat","reply_message":"Răspunde","no_results":"Nu există marcaje.","topic_flagged":"Această \u003cstrong\u003ediscuţie\u003c/strong\u003e a fost marcată.","visit_topic":"Vizualizaţi discuţia pentru a acţiona.","summary":{"action_type_3":{"one":"în afara discuţiei","other":"în afara discuţiei x{{count}}"},"action_type_4":{"one":"nepotrivit","other":"nepotrivite x{{count}}"},"action_type_6":{"one":"preferenţial","other":"preferenţiale x{{count}}"},"action_type_7":{"one":"preferenţial","other":"preferenţiale x{{count}}"},"action_type_8":{"one":"spam","other":"spam-uri x{{count}}"}}},"groups":{"primary":"Grup primar","no_primary":"(nu există grup primar)","title":"Grupuri","edit":"Editează  Grupuri","refresh":"Reîmprospătează","new":"Noi","selector_placeholder":"adaugă utilizatori","name_placeholder":"Numele grupului, fără spaţii, asemenea regulii de utilizator","about":"Editează aici apartentenţa la grupuri şi numele","group_members":"Membrii grupului","delete":"Ştergere","delete_confirm":"Şterg acest grup?","delete_failed":"Imposibil de şters grupul. Dacă este unul automat, nu se poate şterge."},"api":{"generate_master":"Generează cheie API principală","none":"Nu sunt chei API principale active deocamdată.","user":"Utilizator","title":"API","key":"Cheie API","generate":"Generează","regenerate":"Regenerează","revoke":"Revocare","confirm_regen":"Sunteţi sigur ca doriţi să înlocuiţi această cheie API cu una nouă?","confirm_revoke":"Sunteţi sigur ca doriţi să revocaţi acea cheie?","info_html":"Cheia dumneavoastră API vă permite să creaţi şi să actualizaţi discuţii folosind sintaxa JSON.","all_users":"Toţi utilizatorii","note_html":"Păstrează această cheie \u003cstrong\u003esecretă\u003c/strong\u003e, toţi utilizatorii ce o detin pot crea  postări arbitrare pe forum ca oricare alt utilizator."},"backups":{"title":"Rezervare","menu":{"backups":"Rezerve","logs":"Rapoarte"},"none":"Nicio rezervare valabilă.","read_only":{"enable":{"title":"Activearea modul doar-citire","text":"Activeaza modul doar-citire","confirm":"sunteţi sigur că doriţi să activaţi modul doar ctire?"},"disable":{"title":"Dezactivearea modului doar-citire","text":"Dezactiveaza modul doar-citire"}},"logs":{"none":"Nu exista rapoarte..."},"columns":{"filename":"Numele fişierului","size":"Mărime"},"upload":{"text":"ÎNCĂRCARE","uploading":"ÎNCARCĂ","success":"fişierul '{{filename}}' a fost încărcat cu succes.","error":"S-a semnalat o eroare la încărcarea fişierului '{{filename}}': {{message}}"},"operations":{"is_running":"O altă operaţie este în desfăşurare...","failed":"operaţia {{operation}} nu s-a finalizat. Vă rugăm verificaţi rapoartele.","cancel":{"text":"Anulează","title":"Anulează operaţia curentă","confirm":"Sunteţi sigur că doriţi să anulati operaţia curentă?"},"backup":{"text":"Rezerve","title":"Creaţi o rezervă","confirm":"Sunteţi sigur că doriţi să creaţi o nouă rezervă?"},"download":{"text":"Downloadează","title":"Downloadează brezervă"},"destroy":{"text":"Stergere","title":"Sterge rezervă","confirm":"Sunteţi sigur că doriţi să distrugeţi această rezervă ?"},"restore":{"is_disabled":"Restabilirea este dezactivată din setările siteului.","text":"Restabileşte","title":"Restabileşte rezervă","confirm":"Sunteţi sigur că doriţi restabilirea acestei rezerve?"},"rollback":{"text":"Restabilire","title":"Restabileşte baza de date în stadiul anterior","confirm":"Sunteţi sigur că doriţi restabilirea bazei de date în stadul precedent?"}}},"customize":{"title":"Modifică","long_title":"Modificarea Site-ului","header":"Titlu","css":"Foaie de stil","mobile_header":"Titlu mobil","mobile_css":"Foaie de stil mobilă","override_default":"Nu include foaia de stil standard","enabled":"Activat?","preview":"previzualizează","undo_preview":"înlaturş previzualizarea","rescue_preview":"stilul predefinit","explain_preview":"Vizualizează site-ul cu foaia de stil predefinită","explain_undo_preview":"Înapoi la foaia de stil preferentială activată momentan","explain_rescue_preview":"Vizualizeaza site-ul cu foaia de stil predefinită","save":"Salvează","new":"Nou","new_style":"Stil nou","delete":"Şterge","delete_confirm":"Şterge aceste preferinţe?","about":"Modifică foaia de stil CSS şi capetele HTML Modify CSS din site. Adaugă o preferinţa pentru a începe.","color":"Culoare","opacity":"Opacitate","copy":"Copiază","css_html":{"title":"CSS/HTML","long_title":"Customizarile CSS and HTML"},"colors":{"title":"Culori","long_title":"Tabel culori","about":"Modifică culorile folosite în site fară a scrie CSS. Adaugă un nou aranjament pentru a începe.","new_name":"O un nou aranjament pentru culori","copy_name_prefix":"Copiază","delete_confirm":"Şterge acest aranjament de culori?","undo":"rescrie","undo_title":"Rescrie schimbările acestei culori de ultima oară când a fost salvată.","revert":"refacere","revert_title":"Resetează culoarea la stadiul aranjamentului predefinit .","primary":{"name":"primar","description":"Majoritatea textului, iconiţe şi margini."},"secondary":{"name":"secundar","description":"Culoarea principală de fundal şi culoarea textului anumitor butoane."},"tertiary":{"name":"terţiar","description":"Adrese, cateva butoane, notificări, şi culoarea de accent."},"quaternary":{"name":"quaternar","description":"Adrese de navigare."},"header_background":{"name":"fundalul Header-ului","description":"Culoarea de fundal a header-ului din site."},"header_primary":{"name":"header-ul primar","description":"Textul şi inconiţele din header-ul site-ului."},"highlight":{"name":"Iluminare","description":"Culoarea de fundal a elementelor iluminate din pagina, cum ar fi postări şi discuţii."},"danger":{"name":"Pericol","description":"Ilumineazş culoarea pentru acţiuni ca ştergerea postărilor şi a discuţiilor."},"success":{"name":"succes","description":"Indică starea de succes a unei operaţiuni."},"love":{"name":"Iubire","description":"Culoarea butonului de apreciere."}}},"email":{"title":"Email","settings":"Opţiuni","all":"Toate","sending_test":"Trimite email de test...","test_error":"S-a semnalat o problemă la trimtirerea email-ului. Vă rugăm verificaţi setările mailului, Verificaţi ca gazda sa nu bocheze conexiunile de email şi reâncercaţi.","sent":"Trimise","skipped":"Omise","sent_at":"Trimise la","time":"Timp","user":"Utilizator","email_type":"Tipul de Email","to_address":"La adresa","test_email_address":"Adresă email de test","send_test":"Trimite Email de test","sent_test":"trimis!","delivery_method":"Metoda de livrare","preview_digest":"Previzualizează rezumat","preview_digest_desc":"Acesta este o unealtă de previzualizat contentul emailurilor-rezumat trimise de pe forum.","refresh":"Reîmprospătează","format":"Format","html":"html","text":"text","last_seen_user":"Ultimul utilizator văzut:","reply_key":"Cheie de răspuns","skipped_reason":"Motiv omiterii","logs":{"none":"Nu s-au găsit rapoarte.","filters":{"title":"Filtru","user_placeholder":"nume utilizator","address_placeholder":"nume@exemplu.com","type_placeholder":"rezumat, înregistrare...","reply_key_placeholder":"","skipped_reason_placeholder":"motivul"}}},"logs":{"title":"Rapoarte","action":"Acţiune","created_at":"Creat","last_match_at":"Ultima potrivire","match_count":"Potriviri","ip_address":"Adresa IP","delete":"Şterge","edit":"Editează","save":"Salvează","screened_actions":{"block":"blochează","do_nothing":"nu acţiona"},"staff_actions":{"title":"Acţiunile membrilor din staff","instructions":"Click pe numele utilizatorului şi acţiuni pentru a flitra lista. Faceţi click pe avatare pentru a merge la paginile utilizatorului.","clear_filters":"Arată tot","staff_user":"Utilizatorul din staff","target_user":"Utilizator ţintă","subject":"Subiect","when":"Când","context":"Contextul","details":"Detalii","previous_value":"Precedent","new_value":"Nou","diff":"Diff","show":"Arată","modal_title":"Detalii","no_previous":"Nu există valoare precedentă.","deleted":"Nu există valoare nouă. Jurnalele au fost şterse.","actions":{"delete_user":"şterge utilizator","change_trust_level":"schimbă nivelul de încredere","change_site_setting":"schimbă setările site-ului","change_site_customization":"schimbă preferinţele site-ului","delete_site_customization":"şterge preferinţele site-ului","suspend_user":"suspendă utilizator","unsuspend_user":"reactivează utilizator","grant_badge":"acordă insignă","revoke_badge":"revocă insignă"}},"screened_emails":{"title":"Email-uri filtrate","description":"Când cineva încearcă să creeze un nou cont, următorul email va fi verificat iar înregistrarea va fi blocată, sau o altă acţiune va fi iniţiată.","email":"Adresa email","actions":{"allow":"Permite"}},"screened_urls":{"title":"URL-uri filtrate","description":"URL-urile listate aici au fost folosite în postări de către utilizatorii ce sunt identificaţi ca spammeri.","url":"URL","domain":"Domeniu"},"screened_ips":{"title":"IP-uri filtrate","description":"adresele de IP sunt supravegheate. Foloseşte \"permite\" să goleşti lista de IP-uri.","delete_confirm":"Eşti sigur că vrei să anulezi regula pentru %{ip_address}?","actions":{"block":"Blochează","do_nothing":"Permite"},"form":{"label":"Noi:","ip_address":"Adresă IP","add":"Adaugă"}}},"impersonate":{"title":"Imită Utilizator","username_or_email":"Numele de utilizator şi emailul acestuia","help":"Foloseşte această unealtă pentru a imita un cont de utilizator în scopul de debugging.","not_found":"Acest utilizator nu poate fi găsit.","invalid":"Ne pare rău , nu poţi imita acest utilizator."},"users":{"title":"Utilizatori","create":"Adaugă Utilizator cu titlul de Admin","last_emailed":"Ultimul Email trimis","not_found":"Ne pare rău, acest nume de utilizator nu există în sistem.","active":"Activ","nav":{"new":"Nou","active":"Activ","pending":"În aşteptare","admins":"Admini","moderators":"Moduri","suspended":"Suspendate","blocked":"Blocate"},"approved":"Aprobate?","approved_selected":{"one":"aprobă utilizator","other":"aprobă ({{count}}) de utilizatori"},"reject_selected":{"one":"respinge utilizator","other":"respinge ({{count}}) de utilizatori"},"titles":{"active":"Utilizatori activi","new":"Utilizatori noi","pending":"Utilizatori în aşteptare de previzualizare","newuser":"Utilizatori la nielul de încredere 0 (utilizator nou)","basic":"Utilizatori la nivel de încredere 1 (utilizator de baza)","regular":"Utilizatori la nivel de încredere 2 (Utilizator normal)","leader":"Utilizatori la nivel de încredere 3 (Lider)","elder":"Utilizatori la nivel de încredere 4 (Batran)","admins":"Utilizatori admin","moderators":"Moderatori","blocked":"Utilizatori blocaţi","suspended":"Utilizatori suspendaţi"},"reject_successful":{"one":"Aţi refuzat cu succes 1 utilizator.","other":"Aţi refuzat cu succes  %{count} de utilizatori."},"reject_failures":{"one":"Nereuşită în a refuza 1 utilizator.","other":"Nereuşită în a refuza  %{count} de utilizatori."}},"user":{"suspend_failed":"Ceva nu a funcţionat în suspendarea acestui utilizator {{error}}","unsuspend_failed":"Ceva nu a funcţionat în activarea acestui utilizator {{error}}","suspend_duration":"Pentru cât timp va fi suspendat utilizatorul?","suspend_duration_units":"(zile)","suspend_reason_label":"De ce suspendaţi? Acest text \u003cb\u003eva fi vizibil oricui\u003c/b\u003e pe pagina de profil a utilizatorului, şi va fi arătat utilizatorului când încearca autentificara. încercaţi să fiţi succint.","suspend_reason":"Motiv","suspended_by":"Suspendat de","delete_all_posts":"Şterge toate postările","delete_all_posts_confirm":"Sunteţi pe cale să ştergeţi %{posts} de postări şi %{topics} de discuţii. Sunteţi sigur?","suspend":"Suspendat","unsuspend":"Activat","suspended":"Suspendat?","moderator":"Moderator?","admin":"Admin?","blocked":"Blocat?","show_admin_profile":"Admin","edit_title":"Editează Titlu","save_title":"Salvează Titlu","refresh_browsers":"Fortează reîmprospătarea browserului","show_public_profile":"Arată profilul public","impersonate":"Imită","ip_lookup":"Cautare IP","log_out":"Ieşire","logged_out":"Acest utilizator a ieşit de pe toate dispozitivele","revoke_admin":"Revocă tirlu Admin","grant_admin":"Acordă titlu Admin","revoke_moderation":"Revocă titlu moderator","grant_moderation":"Acordă titlu moderator","unblock":"Deblochează","block":"Blochează","reputation":"Reputaţie","permissions":"Permisiuni","activity":"Activitate","like_count":"Aprecieri primite","private_topics_count":"Discuţii private","posts_read_count":"Postări citite","post_count":"Postări Create","topics_entered":"Discuţii Văzute","flags_given_count":"Marcaje acordate","flags_received_count":"Marcaje primite","approve":"Aprobare","approved_by":"aprobat de","approve_success":"Utilizator aprobat , email trimis cu instrucţiuni de activare.","approve_bulk_success":"Succes! Toţi utilizatorii selectaţi au fost aprobaţi şi notificaţi.","time_read":"Timp de citire","delete":"Ştergere Utilizator","delete_forbidden_because_staff":"Adminii şi moderatorii nu pot fi sterşi.","delete_forbidden":{"one":"Utilizatorul nu poate fi şters dacă are postări. Ştergeţi toate postările înainte de a şterge un utilizator. (Postările mai vechi de %{count} de zile nu pot fi şterse.)","other":"Utilizatorii nu pot fi ştersi dacă au postări. ştergeţi toate postările înainte de a şterge un utilizator. (Postările mai vechi de %{count} de zile nu pot fi şterse.)"},"cant_delete_all_posts":{"one":"Nu poţi şterge toate postările. Unele postări sunt mai vechi de  %{count} zi. (Utilizatorul_Şters_maxim_postări_opţiuni vârstă.)","other":"Nu poţi şterge postările. Unele postări sunt mai vechi de %{count} de zile. (Utilizatorii_Şterşi_maxim_postări_opţiuni vârstă.)"},"cant_delete_all_too_many_posts":{"one":"Nu poţi şterge postările fiindcă utlizatorul are mai mult de o postare. (şterge_toate_postările_maxim)","other":"Nu poţi şterge postările fiindcă utlizatorii au mai mult de %{count} de postări.  (şterge_toate_postările_maxim)"},"delete_confirm":"Sunteţi sigur că doriţi ştergerea acestui utilizator? Acţiunea este permanentă!","delete_and_block":"\u003cb\u003eDa\u003c/b\u003e, şi \u003cb\u003eblock\u003c/b\u003e viitoarele autentificări pe acest email şi adresă IP","delete_dont_block":"\u003cb\u003eDa\u003c/b\u003e, şterge decât utilizatorul","deleted":"Utilizatorul a fost şters.","delete_failed":"S-a semnalat o eroare la ştergerea utilizatorului. Asiguraţi-vă că toate postările sunt şterse înainte de a încerca ştergerea utilizatorului.","send_activation_email":"Trimite email de activare","activation_email_sent":"Um email de activare a fost trimis.","send_activation_email_failed":"S-a semnalat o eroare la trimiterea altui email de activare. %{error}","activate":"Activarea contului","activate_failed":"S-a semnalat o problemă la activarea utilizatorului.","deactivate_account":"Dezactivează cont","deactivate_failed":"S-a semnalat o problemă la dezactivarea utilizatoprului.","unblock_failed":"S-a semnalat o problemă la deblocarea utlizatorului.","block_failed":"S-a semnalat o problemă la blocarea utilizatorului.","deactivate_explanation":"Un utilizator dezactivat va trebuii sa-şi reactvieze emailul.","suspended_explanation":"Un utilizator suspendat nu se poate autentifica","block_explanation":"Un utilizator blocat nu poate posta sau pornii o discuţie.","trust_level_change_failed":"S-a semnalat o problemă la schimbarea nivelului de încredere al utilizatorului.","suspend_modal_title":"Suspendă utilizator","trust_level_2_users":"utilizatori de nivel de încredere 2 ","trust_level_3_requirements":"Cerinţe pentru nivelul 3 de încredere","tl3_requirements":{"title":"Cerinţe pentru nivelul 3 de încredere","table_title":"În ultimele 100 de zile:","value_heading":"Valoarea","requirement_heading":"Cerinţe","visits":"Vizite","days":"zile","topics_replied_to":"Discuţii la care s-a răspuns","topics_viewed":"Discuţii văzute","topics_viewed_all_time":"Discuţii văzute (din totdeauna)","posts_read":"Postări citite","posts_read_all_time":"Postări citite (din totdeauna)","flagged_posts":"Postări marcate","flagged_by_users":"Utilizatori ce au marcat","qualifies":"Calificări pentru nivelul 3 de încredere.","will_be_promoted":"Vor fi promovaţi în 24 de ore.","does_not_qualify":"Nu se califică pentru nivelul 3 de încredere."}},"site_content":{"none":"Alege un tip de conţinut pentru editare.","title":"Conţinut","edit":"Editează conţinutul site-ului"},"site_settings":{"show_overriden":"Arată doar rescrierile","title":"Setări","reset":"resetează","none":"nimic","no_results":"Nu s-au găsit rezultate.","clear_filter":"Goleşte","categories":{"all_results":"Toate","required":"Cerute","basic":"Setări de bază","users":"Utilizatori","posting":"Postări","email":"Email","files":"Fişiere","trust":"Niveluri de încredere","security":"Securitate","onebox":"Onebox","seo":"SEO","spam":"Spam","rate_limits":"Limita rată","developer":"Developer","embedding":"Includere","legal":"Legal","uncategorized":"Altele","backups":"Rezervări","login":"Autentificare"}},"badges":{"title":"Insigne","new_badge":"Insignă nouă","new":"Nou","name":"Nume","badge":"Insignă","display_name":"Afiţeaza numele","description":"Descrierea","badge_type":"Tipul insignei","badge_grouping":"Grup","badge_groupings":{"modal_title":"Insigne de grup"},"granted_by":"Acordat de","granted_at":"Acordat la","save":"Salvează","delete":"Şterge","delete_confirm":"Sunteţi sigur că stergeţi insigna?","revoke":"Revocă","revoke_confirm":"Sunteţi sigur ca  revocaţi insigna?","edit_badges":"Editează insigne","grant_badge":"Acordă insignă","granted_badges":"Insigne acordate","grant":"Acordă","no_user_badges":"%{name} nu i-a fost acordată nicio insignă.","no_badges":"Nu există nicio insignă ce poate fi acordată.","allow_title":"Permite insigna sa fie folosită ca titlu","multiple_grant":"Poate sa fie acordată de mai multe ori","listable":"Arată insignă pe pagina publică a insignelor","enabled":"Activează insignă","icon":"Iconită","query":"Verificare insignă (SQL)","target_posts":"Verifică postarea ţintă","auto_revoke":"Porneşte verificarea de revocare î fiecare zi","show_posts":"Arata postări ce acordă insigne pe pagina de insgne","preview":"previzualizează insignă","trigger":"Declanşator","trigger_type":{"none":"reinprospatează zilnic","post_action":"Când un utilizator reacţionează la postare","post_revision":"Când un utlizator crează sau editează o postare","trust_level_change":"Când un utilizator schimbă nivelul de încredere","user_change":"Când un utilizator este editat sau creat"}}},"lightbox":{"download":"descarcă"},"keyboard_shortcuts_help":{"title":"Scurtături de tastatură","jump_to":{"title":"Sari la","home":"\u003cb\u003eg\u003c/b\u003e apoi \u003cb\u003eh\u003c/b\u003e Home (ultimele)","latest":"\u003cb\u003eg\u003c/b\u003e apoi \u003cb\u003el\u003c/b\u003e ultimele","new":"\u003cb\u003eg\u003c/b\u003e apoi \u003cb\u003en\u003c/b\u003e noi","unread":"\u003cb\u003eg\u003c/b\u003e apoi \u003cb\u003eu\u003c/b\u003e Necitite","starred":"\u003cb\u003eg\u003c/b\u003e apoi \u003cb\u003ef\u003c/b\u003e Participare","categories":"\u003cb\u003eg\u003c/b\u003e apoi \u003cb\u003ec\u003c/b\u003e Categorii"},"navigation":{"title":"Navigare","jump":"\u003cb\u003e#\u003c/b\u003e Mergi la postarea numarul","back":"\u003cb\u003eu\u003c/b\u003e Înapoi","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Muta selecţia sus/jos","open":"\u003cb\u003eo\u003c/b\u003e sau \u003cb\u003eIntrodu\u003c/b\u003e Deschide discutia selectată","next_prev":"\u003cb\u003e`\u003c/b\u003e/\u003cb\u003e~\u003c/b\u003e selecţia Urmatoare/Precedentă"},"application":{"title":"Applicaţia","create":"\u003cb\u003ec\u003c/b\u003e Crează discuţie nouă","notifications":"\u003cb\u003en\u003c/b\u003e Deschide notificare","search":"\u003cb\u003e/\u003c/b\u003e Caută","help":"\u003cb\u003e?\u003c/b\u003e Deschide ajutorul de scurtături de tastatură"},"actions":{"title":"Acţiuni","star":"\u003cb\u003ef\u003c/b\u003e Participare la discuţie","share_topic":"\u003cb\u003eshift s\u003c/b\u003e distribuie discuţie","share_post":"\u003cb\u003es\u003c/b\u003e distribuie postare","reply_topic":"\u003cb\u003eshift r\u003c/b\u003e Raspunde la discuţie","reply_post":"\u003cb\u003er\u003c/b\u003e Răspunde la postare","quote_post":"\u003cb\u003eq\u003c/b\u003e Citează postarea","like":"\u003cb\u003el\u003c/b\u003e Apreciează postarea","flag":"\u003cb\u003e!\u003c/b\u003e Marchează postarea","bookmark":"\u003cb\u003eb\u003c/b\u003e Marchează cu semn de carte postarea","edit":"\u003cb\u003ee\u003c/b\u003e Editează postarea","delete":"\u003cb\u003ed\u003c/b\u003e Şterge postarea","mark_muted":"\u003cb\u003em\u003c/b\u003e apoi \u003cb\u003em\u003c/b\u003e Marchează discuţia ca silenţios","mark_regular":"\u003cb\u003em\u003c/b\u003e apoi \u003cb\u003er\u003c/b\u003e Marchează discuţia ca normală","mark_tracking":"\u003cb\u003em\u003c/b\u003e apoi \u003cb\u003et\u003c/b\u003e Marchează discuţia ca urmărită","mark_watching":"\u003cb\u003em\u003c/b\u003e apoi \u003cb\u003ew\u003c/b\u003e Marchează discuţia ca privită"}},"badges":{"title":"Insigne","allow_title":"permite insigna ca titlu?","multiple_grant":"acordă de mai multe ori?","badge_count":{"one":"o Insignă","other":"%{count} de insigne"},"more_badges":{"one":"+ încă una","other":"+inca %{count} de insigne"},"granted":{"one":"1 acordată","other":"%{count} acordate"},"select_badge_for_title":"Selectează o insignă pentru a o folosii ca titlu","no_title":"\u003cfără titlu\u003e","badge_grouping":{"getting_started":{"name":"Să începem"},"community":{"name":"Communitate"},"trust_level":{"name":"Nivel de încredere"},"other":{"name":"Altele"},"posting":{"name":"Postare"}},"badge":{"editor":{"name":"Editor","description":"Prima postare editată"},"basic_user":{"name":"De baza","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/4\"\u003eAcordată\u003c/a\u003e toate funcţiile esenţiale"},"regular_user":{"name":"Normal","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/5\"\u003eAcordată\u003c/a\u003e invitaţii"},"leader":{"name":"Lider","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/6\"\u003eAcrodată\u003c/a\u003e recategoriseşte , redenumeşte, adrese urmărite şi lounge"},"elder":{"name":"Batran","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/7\"\u003eAcordată\u003c/a\u003e editare globală, pin, închide, arhivă, desparte şi uneşte"},"welcome":{"name":"Bine ai venit","description":"A primit o apreceiere"},"autobiographer":{"name":"Autobiograf","description":"Informaţia de \u003ca href=\"/my/preferences\"\u003eprofil\u003c/a\u003e completă a utilizatorului"},"nice_post":{"name":"Draguţa postare","description":"A primit 10 aprecieri pentru o postare. Această insignă poate fi acordată de multiple ori"},"good_post":{"name":"Postare bună","description":"A primit 25 de aprecieri pentru o postare. Această insignă poate fi acordată de multiple ori"},"great_post":{"name":"Pstare foarte bună","description":"A primit 50 de aprecieri pentru o postare. Această insignă poate fi acordată de multiple ori"},"first_like":{"name":"Prima apreciere","description":"A apreciat o postare"},"first_flag":{"name":"Primul marcaj","description":"A marcat o postare"},"first_share":{"name":"Prima distribuire","description":"A distribuit o postare"},"first_link":{"name":"Prima adresă","description":"A adăugat o adresă internă catre altă discuţie"},"first_quote":{"name":"Primul citat","description":"A citat un alt utilizator"},"read_guidelines":{"name":"Citeşte reguli de ajutor","description":"Citeşte \u003ca href=\"/regulile de ajutor\"\u003e comune\u003c/a\u003e"},"reader":{"name":"Cititorul","description":"A citit fiecare postare dintr-o discuţie cu mai mult de 100 de postări."}}}}}};
I18n.locale = 'ro';
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
// locale : romanian (ro)
// author : Vlad Gurdiga : https://github.com/gurdiga
// author : Valentin Agachi : https://github.com/avaly

(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define(['moment'], factory); // AMD
    } else if (typeof exports === 'object') {
        module.exports = factory(require('../moment')); // Node
    } else {
        factory(window.moment); // Browser global
    }
}(function (moment) {
    function relativeTimeWithPlural(number, withoutSuffix, key) {
        var format = {
                'mm': 'minute',
                'hh': 'ore',
                'dd': 'zile',
                'MM': 'luni',
                'yy': 'ani'
            },
            separator = ' ';
        if (number % 100 >= 20 || (number >= 100 && number % 100 === 0)) {
            separator = ' de ';
        }

        return number + separator + format[key];
    }

    return moment.defineLocale('ro', {
        months : "ianuarie_februarie_martie_aprilie_mai_iunie_iulie_august_septembrie_octombrie_noiembrie_decembrie".split("_"),
        monthsShort : "ian._febr._mart._apr._mai_iun._iul._aug._sept._oct._nov._dec.".split("_"),
        weekdays : "duminică_luni_marți_miercuri_joi_vineri_sâmbătă".split("_"),
        weekdaysShort : "Dum_Lun_Mar_Mie_Joi_Vin_Sâm".split("_"),
        weekdaysMin : "Du_Lu_Ma_Mi_Jo_Vi_Sâ".split("_"),
        longDateFormat : {
            LT : "H:mm",
            L : "DD.MM.YYYY",
            LL : "D MMMM YYYY",
            LLL : "D MMMM YYYY H:mm",
            LLLL : "dddd, D MMMM YYYY H:mm"
        },
        calendar : {
            sameDay: "[azi la] LT",
            nextDay: '[mâine la] LT',
            nextWeek: 'dddd [la] LT',
            lastDay: '[ieri la] LT',
            lastWeek: '[fosta] dddd [la] LT',
            sameElse: 'L'
        },
        relativeTime : {
            future : "peste %s",
            past : "%s în urmă",
            s : "câteva secunde",
            m : "un minut",
            mm : relativeTimeWithPlural,
            h : "o oră",
            hh : relativeTimeWithPlural,
            d : "o zi",
            dd : relativeTimeWithPlural,
            M : "o lună",
            MM : relativeTimeWithPlural,
            y : "un an",
            yy : relativeTimeWithPlural
        },
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 7  // The week that contains Jan 1st is the first week of the year.
        }
    });
}));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('MMMM D, YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
