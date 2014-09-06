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
MessageFormat.locale.uk = function (n) {
  if ((n % 10) == 1 && (n % 100) != 11) {
    return 'one';
  }
  if ((n % 10) >= 2 && (n % 10) <= 4 &&
      ((n % 100) < 12 || (n % 100) > 14) && n == Math.floor(n)) {
    return 'few';
  }
  if ((n % 10) === 0 || ((n % 10) >= 5 && (n % 10) <= 9) ||
      ((n % 100) >= 11 && (n % 100) <= 14) && n == Math.floor(n)) {
    return 'many';
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
r += "Є ще ";
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
r += "<a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " непрочитана тема</a> ";
return r;
},
"few" : function(d){
var r = "";
r += "<a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " непрочитані теми</a> ";
return r;
},
"many" : function(d){
var r = "";
r += "<a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " непрочитаних тем</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "<a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " непрочитаних тем</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["uk"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
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
r += "і ";
return r;
},
"false" : function(d){
var r = "";
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
})() + " нова</a> тема";
return r;
},
"few" : function(d){
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
r += "і ";
return r;
},
"false" : function(d){
var r = "";
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
})() + " нові</a> теми";
return r;
},
"many" : function(d){
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
r += "і ";
return r;
},
"false" : function(d){
var r = "";
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
})() + " нових</a> тем";
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
r += "і ";
return r;
},
"false" : function(d){
var r = "";
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
})() + " нових</a> тем";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["uk"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ", або ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "перегляньте інші теми у ";
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
}});I18n.translations = {"uk":{"js":{"number":{"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Байт","few":"Байтів","other":"Байтів"},"gb":"ГБ","kb":"КБ","mb":"МБ","tb":"ТБ"}}}},"dates":{"tiny":{"half_a_minute":"\u003c 1 хв","date_year":"MMM 'YY"},"medium_with_ago":{"x_hours":{"one":"1 годину тому","few":"годин тому: %{count}","other":"годин тому: %{count}"},"x_days":{"one":"1 день тому","few":"днів тому: %{count}","other":"днів тому: %{count}"}}},"share":{"topic":"поширити посилання на цю тему","post":"поширити посилання на допис #%{postNumber}","close":"сховати","twitter":"поширити це посилання в Twitter","facebook":"поширити це посилання в Facebook","google+":"поширити це посилання в Google+","email":"надіслати це посилання електронною поштою"},"edit":"редагувати назву та категорію цієї теми","not_implemented":"Цей функціонал ще не реалізовано, даруйте!","no_value":"Ні","yes_value":"Так","generic_error":"Даруйте, виникла помилка.","generic_error_with_reason":"Виникла помилка: %{error}","age":"Вік","joined":"Приєднався(-лась)","admin_title":"Адмін","flags_title":"Скарги","show_more":"показати більше","links":"Посилання","links_lowercase":"посилання","faq":"Часті запитання","guidelines":"Інструкції","privacy_policy":"Політика конфіденційності","privacy":"Конфіденційність","terms_of_service":"Умови Використання","mobile_view":"Вигляд для мобільного","desktop_view":"Вигляд для настільного комп'ютера","you":"Ви","or":"або","now":"щойно","read_more":"читати більше","more":"Більше","less":"Менше","never":"ніколи","daily":"щодня","weekly":"щотижня","every_two_weeks":"кожні два тижні","max":"max","suggested_topics":{"title":"Пропоновані теми"},"bookmarks":{"not_logged_in":"вибачте, але ви повинні увійти, щоб додавати повідомлення до закладок ","created":"ви додали цей допис до закладок","not_bookmarked":"ви прочитали цей допис; натисніть, щоб додати його до закладок","last_read":"це останній допис, що ви прочитали; натисніть, щоб додати його до закладок","remove":"Видалити Закладку"},"topic_count_latest":{"one":"{{count}} нова чи оновлена тема.","few":"нових чи оновлених тем: {{count}}.","other":"нових чи оновлених тем {{count}}."},"topic_count_unread":{"one":"{{count}} непрочитана тема.","few":"непрочитаних тем: {{count}}.","other":"непрочитаних тем: {{count}}."},"topic_count_new":{"one":"{{count}} нова тема.","few":"нових тем {{count}}.","other":"нових тем: {{count}}."},"click_to_show":"Натисніть, щоб подивитися.","preview":"попередній перегляд","cancel":"скасувати","save":"Зберегти зміни","saving":"Збереження...","saved":"Збережено!","upload":"Завантажити","uploading":"Завантаження...","uploaded":"Завантажено!","enable":"Включити","disable":"Відключити","undo":"Скасувати","revert":"Повернути","choose_topic":{"none_found":"Не знайдено тем.","title":{"search":"Шукати тему за назвою, url або id:","placeholder":"введіть назву теми"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e написав(ла) \u003ca href='{{topicUrl}}'\u003eтему\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eВи\u003c/a\u003e написали \u003ca href='{{topicUrl}}'\u003eтему\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e відповів(ла) на \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eВи\u003c/a\u003e відповіли на \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e відповів(ла) на \u003ca href='{{topicUrl}}'\u003eтему\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eВи\u003c/a\u003e відповіли на \u003ca href='{{topicUrl}}'\u003eтему\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e згадав(ла) \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e згадав(ла) \u003ca href='{{user2Url}}'\u003eВас\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eВи\u003c/a\u003e згадали \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Написано користувачем \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Написано \u003ca href='{{userUrl}}'\u003eВами\u003c/a\u003e","sent_by_user":"Надіслано користувачем \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Надіслано \u003ca href='{{userUrl}}'\u003eВами\u003c/a\u003e"},"groups":{"visible":"Група видна всім користувачам","title":{"one":"група","few":"групи","other":"групи"},"members":"Members","posts":"Posts","alias_levels":{"title":"Who can use this group as an alias?","nobody":"Nobody","only_admins":"Only admins","mods_and_admins":"Only moderators and Admins","members_mods_and_admins":"Only group members, moderators and admins","everyone":"Everyone"}},"user_action_groups":{"1":"Вподобані","2":"Отримані вподобання","3":"Закладки","4":"Теми","5":"Дописи","6":"Відповіді","7":"Згадки","9":"Цитати","10":"Позначені зірочкою","11":"Редагування","12":"Надіслані","13":"Вхідні"},"categories":{"all":"всі категорії","all_subcategories":"все","no_subcategory":"немає","category":"Категорія","posts":"Повідомлення","topics":"Теми","latest":"Останні","latest_by":"latest by","toggle_ordering":"показати/сховати елемент керування для впорядкування","subcategories":"Підкатегорії","topic_stats":"Кількість нових тем.","post_stats":"Кількість нових дописів."},"ip_lookup":{"title":"Пошук IP адреси","hostname":"Ім'я хоста","location":"Місцеположення","organisation":"Організація","phone":"Телефон","other_accounts":"Інші облікові записи з цією IP адресою"},"user":{"said":"{{username}} сказав(ла):","profile":"Профіль","mute":"Mute","edit":"Редагувати налаштування","download_archive":"звантажити архів з моїми дописами","private_message":"Приватне повідомлення","private_messages":"Повідомлення","activity_stream":"Активність","preferences":"Налаштування","bookmarks":"Закладки","bio":"Про мене","invited_by":"Запрошений(а)","trust_level":"Рівень довіри","notifications":"Сповіщення","dynamic_favicon":"Відображати сповіщення про вхідні повідомлення на піктограмі сайта (експериментальне)","edit_history_public":"Дати іншим дивитися версії мого повідомлення","external_links_in_new_tab":"Відкривати всі зовнішні посилання у новій вкладці","enable_quoting":"Увімкнути відповіді на цитати для виділеного тексту","change":"змінити","moderator":"{{user}} є модератором","admin":"{{user}} є адміном","moderator_tooltip":"Цей користувач є модератором","admin_tooltip":"Цей користувач є адміністратором","suspended_notice":"Цього користувача призупинено до {{date}}.","suspended_reason":"Причина: ","watched_categories":"Відслідковувані","watched_categories_instructions":"You will automatically watch all new topics in these categories. You will be notified of all new posts and topics, plus the count of unread and new posts will also appear next to the topic's listing.","tracked_categories":"Відстежувані","muted_categories":"Ігноровані","muted_categories_instructions":"Ви не будете отримувати жодних сповіщень про нові теми у цих категоріях, і вони не з'являтимуться у вкладці Непрочитані.","delete_account":"Delete My Account","delete_account_confirm":"Are you sure you want to permanently delete your account? This action cannot be undone!","deleted_yourself":"Your account has been deleted successfully.","delete_yourself_not_allowed":"You cannot delete your account right now. Contact an admin to do delete your account for you.","staff_counters":{"flagged_posts":"Позначені дописи","deleted_posts":"видалені повідомлення","suspensions":"тимчасові припинення"},"messages":{"all":"Всі","mine":"Мої","unread":"Непрочитані"},"change_password":{"success":"(лист надіслано)","in_progress":"(надсилання листа)","error":"(помилка)","action":"Надіслати лист для відновлення паролю","set_password":"Встановити пароль"},"change_about":{"title":"Змінити Про мене"},"change_username":{"title":"Зміна імені користувача","confirm":"Якщо Ви зміните ім'я користувача, всі попередні цитування Ваших дописів та згадки @імені буде порушено. Ви точно абсолютно впевнені, що хочете цього?","taken":"Даруйте, це ім'я користувача вже зайняте.","error":"Під час зміни імені користувача трапилася помилка.","invalid":"Таке ім'я користувача не підійде. Воно має містити лише цифри та літери"},"change_email":{"title":"Зміна адреси електронної пошти","taken":"Даруйте, ця адреса не доступна.","error":"При зміні адреси електронної пошти сталася помилка. Можливо, ця адреса вже використовується?","success":"Ми надсілали листа на цю скриньку. Будь ласка, виконайте інструкції щодо підтердження."},"change_avatar":{"title":"Зміна аватарки","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, враховуючи","uploaded_avatar":"Інше зображення","uploaded_avatar_empty":"Додати інше зображення","upload_title":"Завантажити своє зображення","upload_picture":"Завантажити Зображення","image_is_not_a_square":"Попередження: ми обрізали Ваше зображення, оскільки воно не квадратне."},"change_profile_background":{"title":"Фон Профіля"},"email":{"title":"Електронна пошта","ok":"Адресу прийнято. Ми надішлемо Вам листа для підтвердження.","invalid":"Будь ласка, введіть правильну адресу електронної пошти.","authenticated":"Вашу скриньку було автентифіковано {{provider}}.","frequency":"Ми будемо надсилати Вам листи тільки якщо ми Вас останнім часом не бачили і Ви ще не бачили те, про що ми Вам пишемо."},"name":{"title":"Ім'я","too_short":"Ваше ім'я надто коротке.","ok":"Ваше ім'я виглядає добре."},"username":{"title":"Ім'я користувача","short_instructions":"Інші можуть посилатися на Вас як на @{{username}}.","available":"Ім'я користувача доступне.","global_match":"Електронна пошта відповідає зареєстрованому імені користувача.","global_mismatch":"Вже зареєстровано. Спробуєте {{suggestion}}?","not_available":"Не доступно. Спробуєте {{suggestion}}?","too_short":"Ім'я користувача надто коротке.","too_long":"Ім'я користувача надто довге.","checking":"Перевірка доступності імені користувача...","enter_email":"Ім'я користувача знайдено. Введіть відповідну електронну скриньку.","prefilled":"Електронна скринька відповідає цьому зареєстрованому імені користувача."},"locale":{"title":"Interface language","default":"(default)"},"password_confirmation":{"title":"Пароль ще раз"},"last_posted":"Останній допис","last_emailed":"Останній електронний лист","last_seen":"Помічено востаннє","created":"Приєднався(лась)","location":"Місцеположення","website":"Вебсайт","email_settings":"Електронна пошта","email_digests":{"title":"Коли Ви не відвідуєте сайт, надсилати на електронну скриньку стислий виклад новин:","daily":"щодня","weekly":"щотижня","bi_weekly":"кожні два тижні"},"email_direct":"Отримувати електронний лист, коли хтось цитує Вас, відповідає на Ваш допис або згадує Ваше @Ім'я","email_private_messages":"Отримувати електронний лист, коли хтось надсилає Вам приватне повідомлення","other_settings":"Інше","categories_settings":"Категорії","new_topic_duration":{"label":"Вважати теми новими, якщо","not_viewed":"Ви їх ще не переглядали"},"auto_track_topics":"Автоматично стежити за темами, які Ви відвідуєте","auto_track_options":{"never":"ніколи","always":"завжди"},"invited":{"search":"шукати запрошення...","title":"Запрошення","user":"Запрошений користувач","truncated":"Показано перші {{count}} запрошень.","redeemed":"Прийняті запрошення","redeemed_at":"Прийнято","pending":"Запрошення, що очікують","topics_entered":"Тем переглянуто","posts_read_count":"Прочитано дописів","expired":"Термін дії цього запрошення сплив.","rescind":"Видалити","rescinded":"Запрошення видалено","time_read":"Час читання","days_visited":"Днів відвідано","account_age_days":"Вік облікового запису в днях","create":"Надіслати Запрошення","bulk_invite":{"text":"Масове Запрошення з Файлу","uploading":"ЗАВАНТАЖЕННЯ"}},"password":{"title":"Пароль","too_short":"Ваш пароль надто короткий.","common":"Цей пароль надто простий.","ok":"Ваш пароль добрий.","instructions":"Має містити щонайменше %{count} символів."},"ip_address":{"title":"Остання IP-адреса"},"registration_ip_address":{"title":"IP Адреса Реєстрації"},"avatar":{"title":"Аватарка"},"title":{"title":"Назва"},"filters":{"all":"Всі"},"stream":{"posted_by":"Опубліковано","sent_by":"Надіслано","private_message":"приватне повідомлення","the_topic":"тема"}},"loading":"Завантаження...","errors":{"reasons":{"network":"Помилка Мережі","unknown":"Помилка"},"desc":{"network":"Будь ласка, перевірте з'єднання.","unknown":"Щось пішло не так."},"buttons":{"back":"Повернутися","again":"Спробувати ще раз","fixed":"Завантаження Сторінки"}},"close":"Закрити","read_only_mode":{"login_disabled":"Login is disabled while the site is in read only mode."},"learn_more":"дізнатися більше...","year":"рік","year_desc":"теми, що були створені у останні 365 днів","month":"місяць","month_desc":"теми, що були створені у останні 30 днів","week":"тиждень","week_desc":"теми, що були створені у останні 7 днів","day":"день","first_post":"Перший допис","mute":"Mute","unmute":"Unmute","last_post":"Останній допис","last_post_lowercase":"останній допис","summary":{"description":"Тут \u003cb\u003e{{count}}\u003c/b\u003e відповідей.","enable":"Підсумувати цю тему","disable":"Показати всі дописи"},"deleted_filter":{"enabled_description":"Ця тема містить видалені дописи, які були сховані.","disabled_description":"Видалені дописи в цій темі показано.","enable":"Сховати Видалені Дописи"},"private_message_info":{"title":"Приватне повідомлення","invite":"Запросити інших...","remove_allowed_user":"Ви точно хочете видалити {{name}} з цього приватного повідомлення?"},"email":"Електронна пошта","username":"Ім'я користувача","last_seen":"Помічено востаннє","created":"Створено","created_lowercase":"створено","trust_level":"Рівень довіри","search_hint":"ім'я користувача або email","create_account":{"title":"Створити Новий Обліковий Запис","failed":"Щось пішло не так; скоріше за все, цю електронну пошту вже зареєстровано, спробуйте посилання Забув пароль"},"forgot_password":{"title":"Забув(ла) пароль","action":"Я забув(ла) свій пароль","invite":"Введіть своє ім'я користувача або адресу електронної скриньки, і ми надішлемо Вам лист для скинення пароля.","reset":"Скинути пароль","complete_username":"Якщо обліковий запис збігається з \u003cb\u003e%{username}\u003c/b\u003e, у найближчий час ви отримаєте email з інструкціями, як змінити ваш пароль."},"login":{"username":"Користувач","password":"Пароль","email_placeholder":"електронна скринька або ім'я користувача","caps_lock_warning":"Caps Lock увімкнено","error":"Невідома помилка","reset_password":"Скинути пароль","or":"Або","authenticating":"Автентифікуємося...","awaiting_confirmation":"Ваш обліковий запис очікує на активацію. Для отримання ще одного активаційного листа використайте посилання Забув пароль.","awaiting_approval":"Ваш обліковий запис ще не затверджено членом команди. Коли його буде активовано, Ви отримаєте електронного листа.","requires_invite":"Даруйте, доступ до цього форуму - лише за запрошеннями.","not_activated":"Ви ще не можете увійти. Ми вже надіслали Вам листа для активації на скриньку \u003cb\u003e{{sentTo}}\u003c/b\u003e. Будь ласка, виконайте інструкції в цьому листі, щоб активувати обліковий запис.","resend_activation_email":"Натисніть тут, щоб отримати ще один лист з активацією.","sent_activation_email_again":"Ми надіслали на Вашу скриньку \u003cb\u003e{{currentEmail}}\u003c/b\u003e ще один лист для активації облікового запису. Протягом кількох хвилин він має з'явитися у Вашій скриньці. Не забувайте також перевіряти теку зі спамом.","google":{"title":"через Google","message":"Автентифікація через Google (перевірте, щоб блокувальники спливних вікон були вимкнені)"},"google_oauth2":{"title":"з Google"},"twitter":{"title":"через Twitter","message":"Автентифікація через Twitter (перевірте, щоб блокувальники спливних вікон були вимкнені)"},"facebook":{"title":"через Facebook","message":"Автентифікація через Facebook (перевірте, щоб блокувальники спливних вікон були вимкнені)"},"yahoo":{"title":"через Yahoo","message":"Автентифікація через Yahoo (перевірте, щоб блокувальники спливних вікон були вимкнені)"},"github":{"title":"через GitHub","message":"Автентифікація через GitHub (перевірте, щоб блокувальники спливних вікон були вимкнені)"}},"composer":{"posting_not_on_topic":"На яку тему Ви хочете відповісти?","saving_draft_tip":"збереження","saved_draft_tip":"збережено","saved_local_draft_tip":"збережено локально","similar_topics":"Ваша тема схожа на...","drafts_offline":"чернетки в офлайні","min_length":{"need_more_for_title":"для назви треба ще {{n}}","need_more_for_reply":"для допису треба ще {{n}}"},"error":{"title_missing":"Заголовок є необхідним","title_too_short":"Заголовок має бути мінімум {{min}} символів","title_too_long":"Заголовок не може бути менше, ніж {{max}} символів","post_missing":"Допис не може бути порожнім","post_length":"Найменший розмір допису має бути {{min}} символів","category_missing":"Ви повинні обрати категорію"},"save_edit":"Зберегти зміни","reply_original":"Відповісти в початковій темі","reply_here":"Відповісти тут","reply":"Відповісти","cancel":"Скасувати","create_topic":"Створити тему","create_pm":"Створити приватне повідомлення","title":"Or press Ctrl+Enter","users_placeholder":"Додати користувача","title_placeholder":"Про що це обговорення, у одному короткому реченні?","edit_reason_placeholder":"чому Ви редагуєте допис?","show_edit_reason":"(додати причину редагування)","reply_placeholder":"Вводьте текст тут. Для форматування використовуйте Markdown або BBCode. Для завантаження зображення перетягніть його або вставте з буферу обміну.","view_new_post":"Перегляньте свій новий допис.","saving":"Збереження...","saved":"Збережено!","uploading":"Завантаження...","show_preview":"попередній перегляд \u0026raquo;","hide_preview":"\u0026laquo; сховати попередній перегляд","quote_post_title":"Процитувати весь допис повністю","bold_title":"Сильне виділення","bold_text":"Сильне виділення тексту","italic_title":"Виділення","italic_text":"виділення тексту","link_title":"Гіперпосилання","link_description":"введіть опис посилання","link_dialog_title":"Вставити гіперпосилання","link_optional_text":"необов'язкова назва","quote_title":"Цитата","quote_text":"Цитата","code_title":"Попередньо форматований текст","upload_title":"Завантажити","upload_description":"введіть опис завантаження","olist_title":"Нумерований список","ulist_title":"Маркований список","list_item":"Елемент списку","heading_title":"Заголовок","heading_text":"Заголовок","hr_title":"Горизонтальна лінія","undo_title":"Скасувати","redo_title":"Повернути","help":"Markdown Editing Help","toggler":"показати або сховати панель редагування","admin_options_title":"Необов'язкові налаштування персоналу для цієї теми","auto_close_label":"Час автоматичного закриття теми:","auto_close_units":"(к-ть годин, час, або дата)","auto_close_examples":"введіть повний час або кількість годин — 24, 17:00, 2013-11-22 14:00","auto_close_error":"Будь ласка, введіть коректне значення."},"notifications":{"title":"Сповіщення про згадку Вашого @імені, відповіді на Ваші дописи та теми, приватні повідомлення, тощо","none":"Наразі Ви не маєте сповіщень.","more":"переглянути старіші сповіщення","total_flagged":"всього дописів, на які поскаржилися","mentioned":"\u003ci title='згадав' class='icon'\u003e@\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='Цитування' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='Відповідь від' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e"},"upload_selector":{"title":"Додати зображення","title_with_attachments":"Додати зображення або файл","from_my_computer":"З мого пристрою","from_the_web":"З інтернету","remote_tip":"введіть адресу зображення у вигляді http://example.com/image.jpg","remote_tip_with_attachments":"введіть адресу зображення або файлу у вигляді http://example.com/file.ext (дозволені розширення: {{authorized_extensions}}).","local_tip":"натисніть, щоб обрати зображення з Вашого пристрою","local_tip_with_attachments":"натисніть, щоб обрати зображення або файл з Вашого пристрою (дозволені розширення: {{authorized_extensions}})","hint":"(Ви також можете перетягувати зображення в редактор, щоб їх завантажити)","uploading":"Завантаження"},"search":{"no_results":"Нічого не знайдено.","searching":"Пошук ...","context":{"topic":"Пошук в цій темі"}},"site_map":"перейти до іншого переліку або категорії тем","go_back":"повернутися назад","not_logged_in_user":"сторінка користувача з підсумком поточної діяльності та налаштуваннями","current_user":"перейти до Вашої сторінки користувача","starred":{"title":"Позначити зірочкою","help":{"star":"додати цю тему до Вашого списку позначених зірочкою","unstar":"видалити цю тему із Вашого списку позначених зірочкою"}},"topics":{"bulk":{"reset_read":"Reset Read","dismiss_new":"Dismiss New","toggle":"перемикач масової дії над темами","actions":"Масові дії","change_category":"Змінити категорію","close_topics":"Закрити теми","notification_level":"Change Notification Level"},"none":{"starred":"Ви ще не позначили зірочкою жодної теми. Щоб позначити тему, клацніть зірочку біля її назви.","unread":"У Вас немає непрочитаних тем.","new":"У Вас немає нових тем.","read":"Ви ще не прочитали жодної теми.","posted":"Ви ще не дописували в жодну тему.","latest":"Останніх тем немає. Шкода.","hot":"Гарячих тем немає.","category":"В категорії {{category}} немає тем.","top":"There are no top topics."},"bottom":{"latest":"Більше немає останніх тем.","hot":"Більше немає гарячих тем.","posted":"There are no more posted topics.","read":"Більше немає прочитаних тем.","new":"Більше немає нових тем.","unread":"Більше немає непрочитаних тем.","starred":"Більше немає тем, позначених зірочкою.","category":"Більше немає тем в категорії {{category}}.","top":"There are no more top topics."}},"topic":{"filter_to":"Показати {{post_count}} дописів в темі","create":"Створити тему","create_long":"Створити нову тему","private_message":"Надіслати приватне повідомлення","list":"Теми","new":"нова тема","title":"Тема","loading_more":"Завантаження інших тем...","loading":"Завантаження теми...","invalid_access":{"title":"Тема є приватною.","description":"Вибачте, у Вас немає доступу до цієї теми!"},"server_error":{"title":"Тему не вдалося завантажити","description":"Даруйте, ми не змогли завантажити цю тему, ймовірно, через проблему зі з'єднанням. Будь ласка, спробуйте ще раз. Якщо проблема залишається, дайте нам знати."},"not_found":{"title":"Тему не знайдено","description":"Даруйте, ми не змогли знайти цю тему. Можливо, її було видалено модератором?"},"back_to_list":"Повернутися до списку тем","options":"Налаштування теми","show_links":"показати посилання в цій темі","toggle_information":"показати/сховати деталі теми","read_more_in_category":"Хочете почитати ще? Перегляньте інші теми в {{catLink}} або {{latestLink}}.","read_more":"Хочете почитати ще? {{catLink}} або {{latestLink}}.","browse_all_categories":"Переглянути всі категорії","view_latest_topics":"перегляньте останні теми","suggest_create_topic":"Чому б не створити тему?","jump_reply_up":"перейти до ранішої відповіді","jump_reply_down":"перейти до пізнішої відповіді","deleted":"Тему було видалено","auto_close_notice":"Ця тема автоматично закриється %{timeLeft}.","auto_close_title":"Налаштування автоматичного закриття","auto_close_save":"Зберегти","auto_close_remove":"Не закривати цю тему автоматично","progress":{"title":"просування по темі","jump_bottom_with_number":"перейти до допису %{post_number}","total":"всього дописів","current":"поточний допис","position":"допис %{current} із %{total}"},"notifications":{"reasons":{"3_6":"Ви будете отримувати сповіщення, бо Ви слідкуєте за цією категорією.","3_5":"Ви будете отримувати сповіщення, бо Ви автоматично почали слідкувати за цією темою.","3_2":"Ви будете отримувати сповіщення, бо Ви слідкуєте за цією темою.","3_1":"Ви будете отримувати сповіщення, бо Ви створили цю тему.","3":"Ви будете отримувати сповіщення, бо Ви слідкуєте за цією темою.","2_4":"Ви будете отримувати сповіщення, бо Ви залишили відповідь в цій темі.","2_2":"Ви будете отримувати сповіщення, бо Ви стежите за цією темою.","2":"Ви будете отримувати сповіщення, бо Ви \u003ca href=\"/users/{{username}}/preferences\"\u003eчитаєте цю тему\u003c/a\u003e.","1_2":"Ви будете отримувати сповіщення лише якщо хтось згадуватиме Ваше @Ім'я або відповідатиме на Ваш допис.","1":"Ви будете отримувати сповіщення лише якщо хтось згадуватиме Ваше @Ім'я або відповідатиме на Ваш допис.","0_7":"Ви ігноруєте всі сповіщення у цій категорії.","0_2":"Ви ігноруєте всі сповіщення з цієї теми.","0":"Ви ігноруєте всі сповіщення з цієї теми."},"watching_pm":{"title":"Слідкувати"},"watching":{"title":"Слідкувати"},"tracking_pm":{"title":"Стежити"},"tracking":{"title":"Стежити"},"regular":{"title":"Звичайно","description":"Ви будете отримувати сповіщення лише якщо хтось згадуватиме Ваше @Ім'я або відповідатиме на Ваш допис."},"muted_pm":{"title":"Ігнорувати","description":"Ви ніколи не будете отримувати жодних сповіщень з цієї приватної переписки."},"muted":{"title":"Ігнорувати","description":"Ви ніколи не будете отримувати жодних сповіщень з цієї теми, і вона не буде відображатися у Вашій вкладці \"Непрочитані\"."}},"actions":{"recover":"Відкликати видалення теми","delete":"Видалити тему","open":"Відкрити тему","close":"Закрити тему","auto_close":"Автоматичне закриття","unpin":"Відкріпити тему","pin":"Закріпити тему","unarchive":"Розархівувати тему","archive":"Заархівувати тему","invisible":"Зробити невидимою","visible":"Зробити видимою","reset_read":"Скинути дані про прочитаність","multi_select":"Перемістити дописи"},"reply":{"title":"Відповісти","help":"почати складати відповідь на цю тему"},"clear_pin":{"title":"Відкріпити","help":"Скасувати закріплення цієї теми, щоб вона більше не з'являлася на початку Вашого переліку тем"},"share":{"title":"Поширити","help":"Поширити посилання на цю тему"},"flag_topic":{"title":"Flag","help":"privately flag this topic for attention or send a private notification about it","success_message":"You successfully flagged this topic."},"inviting":"Запрошуємо...","invite_private":{"title":"Запросити до приватного повідомлення","email_or_username":"Електронна скринька або ім'я запрошуваного користувача","email_or_username_placeholder":"електронна скринька або ім'я користувача","action":"Запросити","error":"Даруйте, під час запрошення цього користувача сталася помилка."},"invite_reply":{"action":"Надіслати запрошення","help":"надіслати запрошення друзям, щоб вони могли відповісти на цю тему в один клац","email_placeholder":"електронна скринька","error":"Вибачте, ми не змогли запросити цю особу. Можливо, вона вже є користувачем?"},"filters":{"cancel":"Знову показати всі дописи в цій темі."},"split_topic":{"title":"Перенесення до нової теми","action":"перенести до нової теми","topic_name":"Назва нової теми","error":"Під час перенесення дописів до нової теми трапилася помилка."},"merge_topic":{"title":"Перенесення до наявної теми","action":"перенести до наявної теми","error":"Під час перенесення дописів до цієї теми трапилася помилка."},"change_owner":{"title":"Змінити Власника Дописів","action":"змінити володіння","error":"Виникла помилка при зміні власника дописів.","label":"Новий Власник Дописів","placeholder":"ім'я користувача нового власника","instructions":{"one":"Будь ласка, оберіть нового власника допису, що належав \u003cb\u003e{{old_user}}\u003c/b\u003e.","few":"Будь ласка, оберіть нового власника {{count}} дописів, що належали \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Будь ласка, оберіть нового власника {{count}} дописів, що належали \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"Зверніть увагу, що будь-які повідомлення про цей допис не будуть передані новому користувачеві заднім числом.\u003cbr\u003eУвага: В даний час залежні від допису дані не передаються по новому користувачеві. Використовуйте з обережністю."},"multi_select":{"select":"вибрати","selected":"вибрано ({{count}})","select_replies":"select +replies","delete":"видалити вибрані","cancel":"скасувати вибір","select_all":"обрати усе","deselect_all":"скасувати вибір всього","description":{"one":"Ви обрали \u003cb\u003e1\u003c/b\u003e допис.","few":"Ви обрали дописів: \u003cb\u003e{{count}}\u003c/b\u003e.","other":"Ви обрали дописів: \u003cb\u003e{{count}}\u003c/b\u003e."}}},"post":{"reply":"У відповідь на {{link}} користувача {{replyAvatar}} {{username}}","reply_topic":"Відповідь на {{link}}","quote_reply":"відповісти на цитату","edit":"Редагування {{link}} користувача {{replyAvatar}} {{username}}","edit_reason":"Причина: ","post_number":"допис {{number}}","in_reply_to":"Відповісти","last_edited_on":"допис востаннє редаговано","reply_as_new_topic":"Відповісти у новій Темі","continue_discussion":"В продовження дискусії {{postLink}}:","follow_quote":"перейти до цитованого допису","show_full":"Показати Увесь Допис","show_hidden":"Показати схований зміст.","expand_collapse":"розгорнути/згорнути","gap":{"one":"1 допис схований","few":"схованих дописів: {{count}}","other":"схованих дописів: {{count}}"},"more_links":"{{count}} ще...","unread":"Допис не прочитаний","has_replies":{"one":"Відповідь","few":"Відповідей","other":"Відповідей"},"errors":{"create":"Даруйте, під час створення допису трапилася помилка. Будь ласка, спробуйте ще раз.","edit":"Даруйте, під час редагування допису трапилася помилка. Будь ласка, спробуйте ще раз.","upload":"Даруйте, під час завантаження цього файлу трапилася помилка. Будь ласка, спробуйте ще раз.","attachment_too_large":"Даруйте, але файл, який Ви намагаєтеся завантажити, надто великий (максимальний розмір складає {{max_size_kb}} кБ).","image_too_large":"Даруйте, але зображення, яке Ви намагаєтеся завантажити, є надто великим (максимальний розмір складає {{max_size_kb}} кБ). Будь ласка, зменшіть його та спробуйте ще раз.","too_many_uploads":"Даруйте, але Ви можете одночасно завантажувати тільки один файл.","upload_not_authorized":"Даруйте, але файл, який Ви намагаєтеся завантажити, є недозволеним (дозволені розширення: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Даруйте, нові користувачі не можуть завантажувати зображення.","attachment_upload_not_allowed_for_new_user":"Даруйте, нові користувачі не можуть завантажувати прикріплення."},"abandon":{"confirm":"Ви впевнені, що хочете облишити цей допис?","no_value":"Ні, зачекайте","yes_value":"Так, облишити"},"archetypes":{"save":"Зберегти налаштування"},"controls":{"reply":"почати складати відповідь на цей допис","like":"вподобати цей допис","has_liked":"Вам сподобався цей допис","undo_like":"прибрати вподобання","edit":"редагувати цей допис","flag":"приватно поскаржитися на цей допис","delete":"видалити цей допис","undelete":"скасувати видалення цього допису","share":"поширити посилання на цей допис","more":"Більше","delete_replies":{"yes_value":"Так, відповіді також видалити","no_value":"Ні, тільки цей допис"},"wiki":"Wiki допис"},"actions":{"flag":"Поскаржитися","it_too":{"off_topic":"Також поскаржитися","spam":"Також поскаржитися","inappropriate":"Також поскаржитися","custom_flag":"Також поскаржитися","bookmark":"Також лишити закладку","like":"Також вподобати","vote":"Також проголосувати за"},"undo":{"off_topic":"Відкликати скаргу","spam":"Відкликати скаргу","inappropriate":"Відкликати скаргу","bookmark":"Скасувати закладку","like":"Скасувати вподобання","vote":"Відкликати голос"},"people":{"notify_moderators":"Звернули увагу модераторів: {{icons}}","notify_moderators_with_url":"\u003ca href='{{postUrl}}'\u003eЗвернули увагу модераторів\u003c/a\u003e: {{icons}}","notify_user":"Надіслали приватне повідомлення: {{icons}}","notify_user_with_url":"Надіслали \u003ca href='{{postUrl}}'\u003eприватне повідомлення\u003c/a\u003e: {{icons}}","bookmark":"Лишили тут закладку: {{icons}}","like":"Вподобали це: {{icons}}","vote":"Проголосували за це: {{icons}}"},"by_you":{"off_topic":"Ви поскаржилися на це як на недотичне до теми","spam":"Ви поскаржилися на це як на спам","inappropriate":"Ви поскаржилися на це як на неприпустиме","notify_moderators":"Ви позначили допис для модерації","notify_user":"Ви надіслали приватне повідомлення цьому користувачу","bookmark":"Ви лишили тут закладку","like":"Ви це вподобали","vote":"Ви проголосували за цей допис"}},"edits":{"one":"{{count}} редагування","other":"без редагувань"},"delete":{"confirm":{"one":"Ви впевнені, що хочете видалити цей допис?","few":"Ви впевнені, що хочете видалити всі ці дописи?","other":"Ви впевнені, що хочете видалити всі ці дописи?"}},"revisions":{"controls":{"first":"Перша версія","previous":"Попередня версія","next":"Наступна версія","last":"Остання версія","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e порівняно з \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Показати результат виведення зі змінами на місці","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Показати бік-о-бік результати виведення","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Показати бік-о-бік коди розмітки","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Розмітка"}},"details":{"edited_by":"Редаговано"}}},"category":{"can":"може\u0026hellip; ","none":"(без категорії)","choose":"Select a category\u0026hellip;","edit":"редагувати","edit_long":"Редагувати","view":"Переглянути теми, що належать до категорії","general":"Основне","settings":"Налаштування","delete":"Видалити категорію","create":"Створити категорію","save":"Зберегти категорію","creation_error":"Під час створення категорії трапилася помилка.","save_error":"Під час збереження категорії трапилася помилка.","name":"Назва категорії","description":"Опис","topic":"тема категорії","badge_colors":"Кольори значка","background_color":"Колір тла","foreground_color":"Колір тексту","name_placeholder":"Не більше одного-двох слів","color_placeholder":"Будь-який веб-колір","delete_confirm":"Ви впевнені, що хочете видалити цю категорію?","delete_error":"Під час видалення категорії трапилася помилка.","list":"List Categories","change_in_category_topic":"Редагувати опис","already_used":"Цей колір вже використовується іншою категорією","security":"Безпека","images":"Зображення","auto_close_label":"Автоматично закривати теми після:","auto_close_units":"годин","email_in":"Custom incoming email address:","allow_badges_label":"Дозволити нагороджувати значками у цій категорії","edit_permissions":"Редагувати дозволи","add_permission":"Додати дозвіл","this_year":"цього року","position":"position","default_position":"Default Position","parent":"Батьківська категорія","notifications":{"watching":{"title":"Слідкувати"},"tracking":{"title":"Стежити"},"regular":{"title":"Звичайний"},"muted":{"title":"Ігноровані"}}},"flagging":{"title":"Чому Ви приватно скаржитеся на цей допис?","action":"Поскаржитися на допис","take_action":"Вжити заходів","notify_action":"Сповістити","delete_spammer":"Видалити спамера","delete_confirm":"Ви збираєтеся видалити \u003cb\u003e%{posts}\u003c/b\u003e дописів і \u003cb\u003e%{topics}\u003c/b\u003e тем цього користувача, видалити його обліковий запис, заблокувати реєстрації з його IP-адреси \u003cb\u003e%{ip_address}\u003c/b\u003e та додати його електронну скриньку \u003cb\u003e%{email}\u003c/b\u003e до чорного списку заблокованих адрес. Ви впевнені, що цей користувач дійсно спамер?","yes_delete_spammer":"Так, видалити спамера","cant":"Даруйте, зараз Ви не можете поскаржитися на цей допис.","custom_placeholder_notify_user":"Чому цей допис вимагає, щоб Ви звернулися до автора напряму і приватно? Будьте конкретними, будьте конструктивними, і обов'язково - доброзичливими.","custom_placeholder_notify_moderators":"Чому цей допис потребує уваги модератора? Дайте нам знати, що саме Вас занепокоїло, і надайте відповідні посилання, якщо це можливо.","custom_message":{"at_least":"введіть принаймні {{n}} символів","more":"ще {{n}}...","left":"залишилось {{n}}"}},"flagging_topic":{"title":"Why are you privately flagging this topic?","action":"Flag Topic","notify_action":"Notify"},"topic_map":{"title":"Підсумок теми","links_shown":"показати всі {{totalLinks}} посилання..."},"topic_statuses":{"locked":{"help":"цю тему закрито; нові відповіді більше не приймаються"},"unpinned":{"title":"Не закріплені"},"pinned":{"title":"Закріплені","help":"цю тему закріплено; вона буде відображатися вгорі своєї категорії"},"archived":{"help":"цю тему заархівовано; вона заморожена і її не можна змінити"},"invisible":{"help":"ця тема є невидимою; вона не відображається у списках тем, і до неї можна отримати доступ лише за прямим посиланням"}},"posts":"Дописи","posts_long":"тема містить {{number}} дописів","original_post":"Перший допис","views":"Перегляди","replies":"Відповіді","views_long":"цю тему переглянули {{number}} разів","activity":"Активність","likes":"Вподобання","likes_long":"в цій темі {{number}} вподобань","users":"Користувачі","category_title":"Категорія","history":"Історія","changed_by":"{{author}}","categories_list":"Список категорій","filters":{"latest":{"title":"Останні","help":"теми з найсвіжішими дописами"},"hot":{"title":"Гарячі","help":"добірка найгарячіших тем"},"starred":{"title":"Із зірочкою","help":"теми, які Ви позначили зірочкою"},"read":{"title":"Прочитані","help":"теми, які Ви прочитали, у порядку, в якому Ви їх читали востаннє"},"categories":{"title":"Категорії","title_in":"Категорія - {{categoryName}}","help":"всі теми, згруповані за категоріями"},"unread":{"title":{"one":"Непрочитані ({{count}})","other":"Непрочитані"}},"new":{"lower_title_with_count":{"one":"{{count}} new"},"lower_title":"new","title":{"zero":"Новий","one":"Нові ({{count}})","other":"Нові"}},"posted":{"title":"Мої дописи","help":"теми, в які Ви дописували"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} ({{count}})","other":"{{categoryName}}"},"help":"Останні теми в категорії {{categoryName}}"},"top":{"title":"Top","yearly":{"title":"Top Yearly"},"monthly":{"title":"Top Monthly"},"weekly":{"title":"Top Weekly"},"daily":{"title":"Top Daily"},"this_year":"This year","this_month":"This month","this_week":"This week","today":"Today","other_periods":"see more top topics"}},"permission_types":{"full":"Створювати / Відповідати / Бачити","create_post":"Відповідати / Бачити","readonly":"Бачити"},"type_to_filter":"введіть, щоб фільтрувати...","admin":{"title":"Адміністратор Discourse","moderator":"Модератор","dashboard":{"title":"Майстерня","last_updated":"Майстерню востаннє оновлено:","version":"Версія","up_to_date":"У вас остання версія!","critical_available":"Доступне критичне оновлення.","updates_available":"Доступні оновлення.","please_upgrade":"Будь ласка, оновіть!","no_check_performed":"Не виконано перевірку на наявність оновлень. Перевірте, чи працює sidekiq.","stale_data":"Останнім часом не здійснювалось перевірок на наявність оновлень. Перевірте, чи працює sidekiq.","version_check_pending":"Здається, Ви нещодавно здійснили оновлення. Чудово!","installed_version":"Встановлена","latest_version":"Остання","problems_found":"У Вашого екземпляра Discourse було виявлено деякі проблеми:","last_checked":"Остання перевірка","refresh_problems":"Оновити","no_problems":"Не виявлено жодних проблем.","moderators":"Модератори:","admins":"Адміни:","blocked":"Заблоковані:","suspended":"Призупинені:","private_messages_short":"ПП","private_messages_title":"Приватні повідомлення","reports":{"today":"Сьогодні","yesterday":"Вчора","last_7_days":"Останні 7 днів","last_30_days":"Останні 30 днів","all_time":"Весь час","7_days_ago":"7 днів тому","30_days_ago":"30 днів тому","all":"Все","view_table":"Таблиця","view_chart":"Стовпчикова діаграма"}},"commits":{"latest_changes":"Останні зміни: оновлюйте Вашу копію часто!","by":"від"},"flags":{"title":"Скарги","old":"Старі","active":"Активні","agree":"Погодитися","agree_title":"Підтвердити, що ця позначка дійсна та коректна","agree_flag_modal_title":"Погодитися та...","agree_flag":"Погодитися з позначкою","delete":"Видалити","delete_title":"Видалити допис, до якого відноситься ця позначка","delete_post_defer_flag_title":"Видалити допис; якщо допис перший, видалити тему","delete_post_agree_flag_title":"Видалити допис; якщо допис перший, видалити тему","delete_flag_modal_title":"Видалити та...","delete_spammer":"Видалити Спамера","disagree_flag_unhide_post":"Відмовитися(відміна приховання допису )","disagree_flag":"Відмовитися","clear_topic_flags":"Done","clear_topic_flags_title":"The topic has been investigated and issues have been resolved. Click Done to remove the flags.","flagged_by":"Позначено","resolved_by":"Вирішено за допомогою","system":"System","error":"Щось трапилося","reply_message":"Відповісти","no_results":"Скарг немає.","topic_flagged":"This \u003cstrong\u003etopic\u003c/strong\u003e has been flagged.","summary":{"action_type_8":{"one":"спам","few":"спаму: x{{count}}","other":"спаму: x{{count}}"}}},"groups":{"primary":"Primary Group","no_primary":"(no primary group)","title":"Групи","edit":"Редагувати групи","refresh":"Оновити","new":"Новий","selector_placeholder":"додати користувачів","name_placeholder":"Group name, no spaces, same as username rule","about":"Edit your group membership and names here","group_members":"Учасники групи","delete":"Видалити","delete_confirm":"Видалити цю групу?","delete_failed":"Не вдалося видалити групу. Якщо це - автоматична група, її неможливо знищити."},"api":{"generate_master":"Згенерувати Головний ключ API","none":"Наразі немає жодного активного ключа API.","user":"Користувач","title":"API","key":"Ключ API","generate":"Згенерувати","regenerate":"Перегенерувати","revoke":"Анулювати","confirm_regen":"Are you sure you want to replace that API Key with a new one?","confirm_revoke":"Are you sure you want to revoke that key?","info_html":"Your API key will allow you to create and update topics using JSON calls.","all_users":"All Users"},"backups":{"title":"Backups","menu":{"backups":"Backups","logs":"Logs"},"none":"No backup available.","read_only":{"enable":{"title":"Enable the read-only mode","text":"Enable read-only mode","confirm":"Are you sure you want to enable the read-only mode?"},"disable":{"title":"Disable the read-only mode","text":"Disable read-only mode"}},"logs":{"none":"No logs yet..."},"columns":{"filename":"Filename","size":"Size"},"upload":{"text":"UPLOAD","uploading":"UPLOADING","success":"'{{filename}}' has successfully been uploaded.","error":"There has been an error while uploading '{{filename}}': {{message}}"},"operations":{"is_running":"An operation is currently running...","failed":"The {{operation}} failed. Please check the logs.","cancel":{"text":"Cancel","title":"Cancel the current operation","confirm":"Are you sure you want to cancel the current operation?"},"backup":{"text":"Backup","title":"Create a backup"},"download":{"text":"Download","title":"Download the backup"},"destroy":{"text":"Delete","title":"Remove the backup","confirm":"Are you sure you want to destroy this backup?"},"restore":{"is_disabled":"Restore is disabled in the site settings.","text":"Restore","title":"Restore the backup","confirm":"Are your sure you want to restore this backup?"},"rollback":{"text":"Rollback","title":"Rollback the database to previous working state","confirm":"Are your sure you want to rollback the database to the previous working state?"}}},"customize":{"title":"Customize","long_title":"Site Customizations","header":"Header","css":"Stylesheet","mobile_header":"Mobile Header","mobile_css":"Mobile Stylesheet","override_default":"Do not include standard style sheet","enabled":"Enabled?","preview":"preview","rescue_preview":"стиль по замовчанню","save":"Save","new":"New","new_style":"New Style","delete":"Delete","delete_confirm":"Delete this customization?","color":"Колір","opacity":"Непрозорість","copy":"Копіювати","css_html":{"title":"CSS/HTML","long_title":"Налаштування CSS та HTML"},"colors":{"title":"Кольори","long_title":"Схеми Кольорів","about":"Змінюйте кольори, що використовуються на сайті без написання CSS. Додати схему, щоб почати. ","new_name":"Нова Схема Кольорів","primary":{"name":"основний"},"secondary":{"name":"вторинний"},"tertiary":{"name":"третинний"},"quaternary":{"description":"Навігаційні посилання."},"header_background":{"name":"фон заголовка"},"header_primary":{"description":"Текст та іконки в заголовку сайту."},"highlight":{"name":"висвітлення"},"love":{"description":"Колір кнопки \"Подобається\"."}}},"email":{"title":"Електронна пошта","settings":"Налаштування","all":"All","sent":"Sent","skipped":"Skipped","sent_at":"Надіслано","time":"Time","user":"Користувач","email_type":"Тип листа","to_address":"Скринька отримувача","test_email_address":"електронна скринька для перевірки","send_test":"Надіслати Тестовий Email","sent_test":"надіслано!","delivery_method":"Спосіб доставки","preview_digest":"Стислий виклад новин","preview_digest_desc":"Це - інструмент для попереднього перегляду вмісту листів зі стислим викладом новин, що надсилаються з Вашого форуму.","refresh":"Оновити","format":"Формат","html":"html","text":"текст","last_seen_user":"Востаннє помічено користувача:","reply_key":"Ключ відповіді","skipped_reason":"Skip Reason","logs":{"none":"No logs found.","filters":{"title":"Filter","user_placeholder":"username","type_placeholder":"digest, signup...","skipped_reason_placeholder":"reason"}}},"logs":{"title":"Журнали","action":"Дія","created_at":"Створено","last_match_at":"Остання відповідність","match_count":"Відповідності","ip_address":"IP","delete":"Видалити","edit":"Редагувати","save":"Зберегти","screened_actions":{"block":"block","do_nothing":"do nothing"},"staff_actions":{"title":"Дії персоналу","instructions":"Натисніть ім'я користувача або дію, щоб відфільтрувати список. Натисніть аватарку, щоб перейти до сторінки користувача.","clear_filters":"Показати все","staff_user":"Член персоналу","target_user":"Target User","subject":"Тема","when":"Коли","context":"Контекст","details":"Деталі","previous_value":"Попереднє","new_value":"Нове","diff":"Diff","show":"Показати","modal_title":"Деталі","no_previous":"There is no previous value.","deleted":"No new value. The record was deleted.","actions":{"delete_user":"видалення користувача","change_trust_level":"зміна рівня довіри","change_site_setting":"зміна налаштування сайта","change_site_customization":"change site customization","delete_site_customization":"delete site customization","suspend_user":"призупинення користувача","unsuspend_user":"скасування призупинення","grant_badge":"надати значок","revoke_badge":"скасувати значок"}},"screened_emails":{"title":"Screened Emails","description":"Коли хтось намагатиметься створити новий обліковий запис, наступні електронні скриньки буде перевірено, і реєстрацію заблоковано, або вжито якихось інших дій.","email":"Електронна скринька","actions":{"allow":"Дозволити"}},"screened_urls":{"title":"Screened URLs","description":"Перелічені тут веб-адреси використовувалися в дописах користувачів, яких було ідентифіковано як спамерів.","url":"Веб-адреса","domain":"Домен"},"screened_ips":{"title":"Screened IPs","description":"IP-адреси, що відслідковуються. Використовуйте \"Дозволити\", щоб включити IP-адресу до білого списку.","delete_confirm":"Ви впевнені, що хочете видалити правило для %{ip_address}?","actions":{"block":"Заблокувати","do_nothing":"Дозволити"},"form":{"label":"Нова:","ip_address":"IP-адреса","add":"Додати"}}},"users":{"title":"Користувачі","create":"Додати адміністратора","last_emailed":"Останній ел. лист","not_found":"Даруйте, такого імені користувача немає в нашій системі.","active":"Активний(а)","nav":{"new":"Нові","active":"Активні","pending":"Очікують","admins":"Адміни","moderators":"Моди","suspended":"Призупинені","blocked":"Заблоковані"},"approved":"Схвалено?","titles":{"active":"Активні користувачі","new":"Нові користувачі","pending":"Користувачі, що очікують на перевірку","newuser":"Користувачі з Рівнем довіри 0 (Новий користувач)","basic":"Користувачі з Рівнем довіри 1 (Базовий користувач)","regular":"Користувачі з Рівнем довіри 2 (Звичайний користувач)","elder":"Користувачі з Рівнем довіри 4 (Старійшина)","admins":"Адміністратори","moderators":"Модератори","blocked":"Заблоковані користувачі","suspended":"Призупинені користувачі"}},"user":{"suspend_failed":"Щось трапилося під час призупинення цього користувача: {{error}}","unsuspend_failed":"Щось трапилося під час скасування призупинення цього користувача: {{error}}","suspend_duration":"На який термін призупинити діяльність цього користувача?","suspend_duration_units":"(днів)","suspend_reason_label":"Чому Ви призупиняєте цього користувача? Цей текст \u003cb\u003eбуде видимим для всіх\u003c/b\u003e на сторінці профілю цього користувача, і його буде показано користувачу при спробі увійти в систему. Будьте лаконічні.","suspend_reason":"Причина","suspended_by":"Призупинено","delete_all_posts":"Видалити всі дописи","delete_all_posts_confirm":"Ви збираєтеся видалити %{posts} дописів і %{topics} тем. Ви впевнені?","suspend":"Призупинити","unsuspend":"Скасувати призупинення","suspended":"Призупинено?","moderator":"Модератор?","admin":"Адмін?","blocked":"Заблоковано?","show_admin_profile":"Адмін","edit_title":"Редагувати назву","save_title":"Зберегти назву","refresh_browsers":"Примусово оновити оглядач","show_public_profile":"Показати публічний профіль","impersonate":"Втілитися","ip_lookup":"Пошук IP","logged_out":"Користувач вийшов зі системи на усіх пристроях","revoke_admin":"Відкликати адміністраторство","grant_admin":"Зробити адміністратором","revoke_moderation":"Відкликати модераторство","grant_moderation":"Зробити модератором","unblock":"Розблокувати","block":"Заблокувати","reputation":"Репутація","permissions":"Дозволи","activity":"Активність","private_topics_count":"Приватних тем","posts_read_count":"Дописів прочитано","post_count":"Дописів створено","topics_entered":"Тем переглянуто","flags_given_count":"Скарг подано","flags_received_count":"Скарг отримано","approve":"Схвалити","approved_by":"схвалено","approve_success":"Користувача схвалено і йому надіслано лист з інструкціями для активації.","approve_bulk_success":"Успіх! Всіх обраних користувачів було схвалено та сповіщено про це.","time_read":"Час читання","delete":"Видалити користувача","delete_forbidden_because_staff":"Адмінів та модераторів видаляти не можна.","deleted":"Користувача було видалено.","delete_failed":"Під час видалення цього користувача трапилася помилка. Переконайтеся, що всі дописи користувача видалено перед тим, як видаляти самого користувача.","send_activation_email":"Надіслати листа для активації","activation_email_sent":"Лист для активації надіслано.","send_activation_email_failed":"Під час надсилання активаційного листа трапилася помилка. %{error}","activate":"Активувати обліковий запис","activate_failed":"Під час активації користувача сталася помилка.","deactivate_account":"Деактивувати обліковий запис","deactivate_failed":"Під час деактивації користувача сталася помилка.","unblock_failed":"Під час розблокування користувача сталася помилка.","block_failed":"Під час блокування користувача сталася помилка.","deactivate_explanation":"Деактивований користувач має повторно підтвердити свою електронну скриньку.","suspended_explanation":"Призупинений користувач не може увійти.","block_explanation":"Заблокований користувач не може дописувати і розпочинати теми.","trust_level_change_failed":"Під час зміни Рівня довіри користувача трапилася помилка.","suspend_modal_title":"Призупинити користувача","trust_level_2_users":"Користувачі з Рівнем довіри 2","trust_level_3_requirements":"Вимоги для Рівня довіри 3","tl3_requirements":{"title":"Вимоги для Рівня довіри 3","table_title":"Протягом останніх 100 днів:","value_heading":"Значення","requirement_heading":"Вимога","visits":"Відвідини","days":"днів","topics_replied_to":"Теми, на які відповів(ла)","topics_viewed":"Переглянуто Тем","topics_viewed_all_time":"Переглянуто Тем (за весь час)","posts_read":"Прочитано Дописів","posts_read_all_time":"Прочитано дописів (весь час)","flagged_posts":"Оскаржені дописи"}},"site_content":{"none":"Виберіть тип вмісту, щоб почати його редагувати.","title":"Вміст","edit":"Редагування вмісту сайта"},"site_settings":{"show_overriden":"Показувати тільки перевизначені","title":"Налаштування","none":"none","no_results":"Не знайдено результатів.","clear_filter":"Очистити","categories":{"all_results":"Всі","required":"Обов'язкові","basic":"Основні установки","users":"Користувачі","posting":"Опублікування","email":"Електронна пошта","files":"Файли","trust":"Рівні довіри","security":"Безпека","seo":"SEO","spam":"Спам","rate_limits":"Обмеження швидкості","developer":"Для розробників","embedding":"Взаємодія","legal":"Legal","backups":"Backups"}},"badges":{"badge":"Значок","save":"Зберегти","delete":"Видалити","revoke":"Відкликати","edit_badges":"Редагувати Значки","grant_badge":"Надати Значок","granted_badges":"Надані Значки","grant":"Надати","no_user_badges":"%{name} не отримував жодного .","no_badges":"Тут немає значків, які можуть бути надані.","allow_title":"Дозволити використання значків як звань","multiple_grant":"Можуть бути надані декілька разів","trigger_type":{"post_action":"Коли користувач щось робить у допису","post_revision":"Коли користувач редагує або створює допис","trust_level_change":"Коли користувач змінює рівень довіри","user_change":"Коли користувач змінений або створений"}}},"lightbox":{"download":"звантажити"},"keyboard_shortcuts_help":{"jump_to":{"title":"Перейти до","categories":"\u003cb\u003eg\u003c/b\u003e,  \u003cb\u003ec\u003c/b\u003e Категорії"},"navigation":{"title":"Навігація","back":"\u003cb\u003eu\u003c/b\u003e Назад","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Перемістити виділення вгору/вниз","open":"\u003cb\u003eo\u003c/b\u003e або \u003cb\u003eEnter\u003c/b\u003e Відкрити обрану тему"},"application":{"title":"Застосунок","create":"\u003cb\u003ec\u003c/b\u003e Створити нову тему","notifications":"\u003cb\u003en\u003c/b\u003e Відкрити сповіщення","search":"\u003cb\u003e/\u003c/b\u003e Пошук","help":"\u003cb\u003e?\u003c/b\u003e Відкрити довідку з поєднань клавіш"},"actions":{"title":"Дії","star":"\u003cb\u003ef\u003c/b\u003e Позначити тему зірочкою","share_post":"\u003cb\u003es\u003c/b\u003e Поширити допис","reply_topic":"\u003cb\u003eshift r\u003c/b\u003e Відповісти на тему","reply_post":"\u003cb\u003er\u003c/b\u003e Відповісти на допис","quote_post":"\u003cb\u003eq\u003c/b\u003e Цитувати допис","like":"\u003cb\u003el\u003c/b\u003e Вподобати допис","flag":"\u003cb\u003e!\u003c/b\u003e Поскаржитися на допис","bookmark":"\u003cb\u003eb\u003c/b\u003e Лишити закладку в дописі","edit":"\u003cb\u003ee\u003c/b\u003e Редагувати допис","delete":"\u003cb\u003ed\u003c/b\u003e Видалити допис","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Ігнорувати сповіщення з теми","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Стежити за темою"}},"badges":{"title":"Значок","multiple_grant":"нагороджено багато разів?","badge_count":{"one":"Значок","few":"Значків: %{count} ","other":"Значків %{count}"},"select_badge_for_title":"Оберіть значок, що буде вашим званням","no_title":"\u003cno title\u003e","badge_grouping":{"community":{"name":"Спільнота"},"other":{"name":"Інше"}},"badge":{"editor":{"name":"Редактор"},"basic_user":{"description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/4\"\u003eНадані\u003c/a\u003e всі основні функції спільноти"},"regular_user":{"name":"Звичайний","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/5\"\u003eНадано\u003c/a\u003e запрошень"}}}}}};
I18n.locale = 'uk';
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
// locale : ukrainian (uk)
// author : zemlanin : https://github.com/zemlanin
// Author : Menelion Elensúle : https://github.com/Oire

(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define(['moment'], factory); // AMD
    } else if (typeof exports === 'object') {
        module.exports = factory(require('../moment')); // Node
    } else {
        factory(window.moment); // Browser global
    }
}(function (moment) {
    function plural(word, num) {
        var forms = word.split('_');
        return num % 10 === 1 && num % 100 !== 11 ? forms[0] : (num % 10 >= 2 && num % 10 <= 4 && (num % 100 < 10 || num % 100 >= 20) ? forms[1] : forms[2]);
    }

    function relativeTimeWithPlural(number, withoutSuffix, key) {
        var format = {
            'mm': 'хвилина_хвилини_хвилин',
            'hh': 'година_години_годин',
            'dd': 'день_дні_днів',
            'MM': 'місяць_місяці_місяців',
            'yy': 'рік_роки_років'
        };
        if (key === 'm') {
            return withoutSuffix ? 'хвилина' : 'хвилину';
        }
        else if (key === 'h') {
            return withoutSuffix ? 'година' : 'годину';
        }
        else {
            return number + ' ' + plural(format[key], +number);
        }
    }

    function monthsCaseReplace(m, format) {
        var months = {
            'nominative': 'січень_лютий_березень_квітень_травень_червень_липень_серпень_вересень_жовтень_листопад_грудень'.split('_'),
            'accusative': 'січня_лютого_березня_квітня_травня_червня_липня_серпня_вересня_жовтня_листопада_грудня'.split('_')
        },

        nounCase = (/D[oD]? *MMMM?/).test(format) ?
            'accusative' :
            'nominative';

        return months[nounCase][m.month()];
    }

    function weekdaysCaseReplace(m, format) {
        var weekdays = {
            'nominative': 'неділя_понеділок_вівторок_середа_четвер_п’ятниця_субота'.split('_'),
            'accusative': 'неділю_понеділок_вівторок_середу_четвер_п’ятницю_суботу'.split('_'),
            'genitive': 'неділі_понеділка_вівторка_середи_четверга_п’ятниці_суботи'.split('_')
        },

        nounCase = (/(\[[ВвУу]\]) ?dddd/).test(format) ?
            'accusative' :
            ((/\[?(?:минулої|наступної)? ?\] ?dddd/).test(format) ?
                'genitive' :
                'nominative');

        return weekdays[nounCase][m.day()];
    }

    function processHoursFunction(str) {
        return function () {
            return str + 'о' + (this.hours() === 11 ? 'б' : '') + '] LT';
        };
    }

    return moment.defineLocale('uk', {
        months : monthsCaseReplace,
        monthsShort : "січ_лют_бер_квіт_трав_черв_лип_серп_вер_жовт_лист_груд".split("_"),
        weekdays : weekdaysCaseReplace,
        weekdaysShort : "нд_пн_вт_ср_чт_пт_сб".split("_"),
        weekdaysMin : "нд_пн_вт_ср_чт_пт_сб".split("_"),
        longDateFormat : {
            LT : "HH:mm",
            L : "DD.MM.YYYY",
            LL : "D MMMM YYYY р.",
            LLL : "D MMMM YYYY р., LT",
            LLLL : "dddd, D MMMM YYYY р., LT"
        },
        calendar : {
            sameDay: processHoursFunction('[Сьогодні '),
            nextDay: processHoursFunction('[Завтра '),
            lastDay: processHoursFunction('[Вчора '),
            nextWeek: processHoursFunction('[У] dddd ['),
            lastWeek: function () {
                switch (this.day()) {
                case 0:
                case 3:
                case 5:
                case 6:
                    return processHoursFunction('[Минулої] dddd [').call(this);
                case 1:
                case 2:
                case 4:
                    return processHoursFunction('[Минулого] dddd [').call(this);
                }
            },
            sameElse: 'L'
        },
        relativeTime : {
            future : "за %s",
            past : "%s тому",
            s : "декілька секунд",
            m : relativeTimeWithPlural,
            mm : relativeTimeWithPlural,
            h : "годину",
            hh : relativeTimeWithPlural,
            d : "день",
            dd : relativeTimeWithPlural,
            M : "місяць",
            MM : relativeTimeWithPlural,
            y : "рік",
            yy : relativeTimeWithPlural
        },

        // M. E.: those two are virtually unused but a user might want to implement them for his/her website for some reason

        meridiem : function (hour, minute, isLower) {
            if (hour < 4) {
                return "ночі";
            } else if (hour < 12) {
                return "ранку";
            } else if (hour < 17) {
                return "дня";
            } else {
                return "вечора";
            }
        },

        ordinal: function (number, period) {
            switch (period) {
            case 'M':
            case 'd':
            case 'DDD':
            case 'w':
            case 'W':
                return number + '-й';
            case 'D':
                return number + '-го';
            default:
                return number;
            }
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

I18n.pluralizationRules['uk'] = function (n) {
  if (n == 0) return ["zero", "none", "other"];
  if (n % 10 == 1 && n % 100 != 11) return "one";
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return "few";
  return "many";
};
