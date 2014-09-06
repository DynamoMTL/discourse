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
MessageFormat.locale.he = function ( n ) {
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
r += "יש ";
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
r += "<a href='/unread'>1 שלא נקרא</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "<a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " שלא נקראו</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["he"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "ו";
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
r += " נושא חדש <a href='/new'>אחד</a>";
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
r += "ו";
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
})() + "</a> נושאים חדשים";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["he"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "עיין בנושאים אחרים ב ";
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
}});I18n.translations = {"he":{"js":{"number":{"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"B","other":"B"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}}},"dates":{"tiny":{"half_a_minute":"פחות מדקה","less_than_x_seconds":{"one":"פחות משנייה","other":"פחות מ-%{count} שניות"},"x_seconds":{"one":"שנייה אחת","other":"%{count} שניות"},"less_than_x_minutes":{"one":"פחות מדקה","other":"פחות מ-%{count} דקות"},"x_minutes":{"one":"דקה אחת","other":"%{count} דקות"},"about_x_hours":{"one":"שעה אחת","other":"%{count} שעות"},"x_days":{"one":"יום אחד","other":"%{count} ימים"},"about_x_years":{"one":"שנה אחת","other":"%{count} שנים"},"over_x_years":{"one":"יותר משנה","other":"יותר מ-%{count} שנים"},"almost_x_years":{"one":"שנה אחת","other":"%{count} שנים"},"date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"דקה אחת","other":"%{count} דקות"},"x_hours":{"one":"שעה אחת","other":"%{count} שעות"},"x_days":{"one":"יום אחד","other":"%{count} ימים"}},"medium_with_ago":{"x_minutes":{"one":"לפני דקה אחת","other":"לפני %{count} דקות"},"x_hours":{"one":"לפני שעה אחת","other":"לפני %{count} שעות"},"x_days":{"one":"אתמול","other":"לפני %{count} ימים"}}},"share":{"topic":"שתפו קישור לנושא זה","post":"שתפו קישור להודעה מספר #%{postNumber}","close":"סגור","twitter":"שתפו קישור זה בטוויטר","facebook":"שתפו קישור זה בפייסבוק","google+":"שתף קישור זה בגוגל+","email":"שלח קישור בדוא\"ל"},"edit":"ערוך את הכותרת והקטגוריה של הנושא","not_implemented":"סליחה, האפשרות הזו עדיין לא מומשה!","no_value":"לא","yes_value":"כן","generic_error":"סליחה, ארעה שגיאה.","generic_error_with_reason":"ארעה שגיאה: %{error}","sign_up":"הרשמה","log_in":"התחברות","age":"גיל","joined":"הצטרף","admin_title":"ניהול","flags_title":"סימוני הודעה","show_more":"הראה עוד","links":"קישורים","links_lowercase":"קישורים","faq":"שאלות נפוצות","guidelines":"כללי התנהלות","privacy_policy":"מדיניות פרטיות","privacy":"פרטיות","terms_of_service":"תנאי השירות","mobile_view":"תצוגת סלולרי","desktop_view":"תצוגת מחשב","you":"את/ה","or":"או","now":"ממש עכשיו","read_more":"קרא עוד","more":"עוד","less":"פחות","never":"אף פעם","daily":"יומית","weekly":"שבועית","every_two_weeks":"דו-שבועית","max":"לכל היותר","character_count":{"one":"תו אחד","other":"{{count}} תווים"},"in_n_seconds":{"one":"בעוד שניה אחת","other":"בעוד {{count}} שניות"},"in_n_minutes":{"one":"בעוד דקה אחת","other":"בעוד {{count}} דקות"},"in_n_hours":{"one":"בעוד שעה אחת","other":"בעוד {{count}} שעות"},"in_n_days":{"one":"בעוד יום אחד","other":"בעוד {{count}} ימים"},"suggested_topics":{"title":"נושאים מוצעים"},"about":{"simple_title":"אודות","title":"אודות %{title}","stats":"סטטיסטיקות אתר","stat":{"all_time":"כל הזמנים","last_7_days":"7 הימים האחרונים"},"like_count":"סך הלייקים","topic_count":"סך הנושאים","post_count":"סך הפרסומים","user_count":"סך המשתמשים"},"bookmarks":{"not_logged_in":"סליחה, עליך להיות מחובר כדי להוסיף פוסט למועדפים","created":"סימנת הודעה זו כמועדפת","not_bookmarked":"קראת הודעה זו, לחץ להוספה למועדפים","last_read":"זו ההודעה האחרונה שקראת, לחץ להוספה למועדפים","remove":"הסר מהמועדפים"},"topic_count_latest":{"one":"נושא חדש או עדכון {{count}} .","other":"{{count}} נושאים חדשים או עדכונים."},"topic_count_unread":{"one":"נושא שלא נקרא {{count}}.","other":"{{count}} נושאים שלא נקראו."},"topic_count_new":{"one":"נושא {{count}} חדש.","other":"{{count}} נושאים חדשים."},"click_to_show":"הקליקו כדי להציג.","preview":"תצוגה מקדימה","cancel":"ביטול","save":"שמור שינויים","saving":"שומר...","saved":"נשמר!","upload":"העלה","uploading":"מעלה...","uploaded":"הועלה!","enable":"לאפשר","disable":"לנטרל","undo":"ביטול (Undo)","revert":"לחזור","banner":{"close":"שחרור באנר זה."},"choose_topic":{"none_found":"לא נמצאו נושאים.","title":{"search":"חפש נושא לפי שם, כתובת או מזהה:","placeholder":"הקלד את כותרת הנושא כאן"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e פרסם \u003ca href='{{topicUrl}}'\u003eאת הנושא\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eאת/ה\u003c/a\u003e פרסמת \u003ca href='{{topicUrl}}'\u003eאת הנושא\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e הגיב ל: \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eאת/ה\u003c/a\u003e הגבת ל: \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e הגיב \u003ca href='{{topicUrl}}'\u003eלנושא הזה\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eאת/ה\u003c/a\u003e הגבת \u003ca href='{{topicUrl}}'\u003eלנושא הזה\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e הזכיר את \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e הזכיר \u003ca href='{{user2Url}}'\u003eאותך\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eאת/ה\u003c/a\u003e הזכרת את \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"פורסם על ידי \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"פורסם על \u003ca href='{{userUrl}}'\u003eידך\u003c/a\u003e","sent_by_user":"נשלח על ידי \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"נשלח על \u003ca href='{{userUrl}}'\u003eידך\u003c/a\u003e"},"groups":{"visible":"הקבוצה זמינה לכל המשתמשים","title":{"one":"קבוצה","other":"קבוצות"},"members":"חברים","posts":"הודעות","alias_levels":{"title":"מי יכול להשתמש בקבוצה הזו ככינוי?","nobody":"אף אחד","only_admins":"רק מנהלים ראשיים","mods_and_admins":"רק מנהלים ומנהלים ראשיים","members_mods_and_admins":"רק חברי הקבוצה, מנהלים ומנהלים ראשיים","everyone":"כולם"}},"user_action_groups":{"1":"לייקים ניתנו","2":"לייקים התקבלו","3":"מועדפים","4":"נושאים","5":"הודעות","6":"תגובות","7":"אזכורים","9":"ציטוטים","10":"כוכבים","11":"עריכות","12":"פריטים שנשלחו","13":"דואר נכנס"},"categories":{"all":"כל הקטגוריות","all_subcategories":"הכל","no_subcategory":"ללא","category":"קטגוריה","posts":"פרסומים","topics":"נושאים","latest":"לאחרונה","latest_by":"לאחרונה על ידי","toggle_ordering":"שנה בקר סדר","subcategories":"תתי קטגוריות","topic_stats":"מספר הנושאים החדשים.","topic_stat_sentence":{"one":"נושא חדש אחד ב-%{unit}.","other":"%{count} נושאים חדשים ב-%{unit}."},"post_stats":"מספר ההודעות החדשות.","post_stat_sentence":{"one":"הודעה חדשה אחת ב-%{unit}.","other":"%{count} הודעות חדשות ב-%{unit}."}},"ip_lookup":{"title":"חיפוש כתובת IP","hostname":"שם מארח (Hostname)","location":"מיקום","location_not_found":"(לא ידוע)","organisation":"ארגון","phone":"טלפון","other_accounts":"חשבונות אחרים עם כתובת IP זהה","no_other_accounts":"(ללא)"},"user":{"said":"{{username}} אמר:","profile":"פרופיל","mute":"השתק","edit":"ערוך העדפות","download_archive":"הורד ארכיון של ההודעות שלי","private_message":"הודעה פרטית","private_messages":"הודעות","activity_stream":"פעילות","preferences":"העדפות","bookmarks":"מועדפים","bio":"אודותיי","invited_by":"הוזמן/הוזמנה על ידי","trust_level":"רמת אמון","notifications":"התרעות","disable_jump_reply":"לא לקפוץ לפוסט החדש שלך לאחר משלוח התשובה","dynamic_favicon":"הראה התרעה על הודעות חדשות באייקון העמוד (נסיוני)","edit_history_public":"אפשרו למשתמשים אחרים לראות את תיקוני הפרסומים שלי","external_links_in_new_tab":"פתח את כל הקישורים החיצוניים בעמוד חדש","enable_quoting":"אפשרו תגובת ציטוט לטקסט מסומן","change":"שנה","moderator":"{{user}} הוא מנהל","admin":"{{user}} הוא מנהל ראשי","moderator_tooltip":"משתמש זה הינו מנחה (Moderator)","admin_tooltip":"משתמש זה הינו מנהל מערכת (Admin)","suspended_notice":"המשתמש הזה מושעה עד לתאריך: {{date}}.","suspended_reason":"הסיבה: ","watched_categories":"נצפה","watched_categories_instructions":"את/ה אוטומטית תצפו בכל הנושאים החדשים בקטגוריות האלה. תקבלו התרעות על כל ההודעות והנושאים החדשים, ובנוסף, כמות ההודעות שלא נקראו יופיעו לצד כל נושא.","tracked_categories":"במעקב","tracked_categories_instructions":"תעקבו באופן אוטומטי אחרי נושאים חדשים בקטגוריות אלו. סך הפרסומים החדשים ואלו שלא נקראו יופיע לצד שם הנושא.","muted_categories":"מושתק","muted_categories_instructions":"לא תקבלו התרעות בנוגע לנושאים חדשים בקטגוריות האלה, והם לא יופיעו בעמוד הלא נקראו שלך.","delete_account":"מחק את החשבון שלי","delete_account_confirm":"אתה בטוח שברצונך למחוק את החשבון? לא ניתן לבטל פעולה זו!","deleted_yourself":"חשבונך נמחק בהצלחה.","delete_yourself_not_allowed":"אתה לא יכול למחוק את חשבונך כרגע. צור קשר עם מנהל כדי שימחק אותו בשבילך.","unread_message_count":"הודעות","staff_counters":{"flags_given":"סימונים שימושיים מוגדרים","flagged_posts":"הודעות מסומנות","deleted_posts":"הודעות שנמחקו","suspensions":"השעיות"},"messages":{"all":"הכל","mine":"שלי","unread":"לא נקראו"},"change_password":{"success":"(דואר אלקטרוני נשלח)","in_progress":"(שולח דואר אלקטרוני)","error":"(שגיאה)","action":"שלח דואר אלקטרוני לשחזור סיסמה","set_password":"הזן סיסמה"},"change_about":{"title":"שינוי בנוגע אליי"},"change_username":{"title":"שנה שם משתמש","confirm":"אם תשנו את שם המשתמש/ת שלך, כל הציטוטים של ההודעות שלך ואזכורי @שם_המשתמש שלך יישברו. את/ה בטוחים לחלוטין שברצונך לשנות?","taken":"סליחה, שם המשתמש הזה תפוס.","error":"ארעה שגיאה בשינוי שם המשתמש שלך.","invalid":"שם המשתמש אינו תקין. עליו לכלול רק אותיות ומספרים."},"change_email":{"title":"שנה דואר אלקטרוני","taken":"סליחה, הכתובת הזו אינה זמינה.","error":"הייתה שגיאה בשינוי כתובת הדואר האלקטרוני שלך. אולי היא תפוסה?","success":"שלחנו דואר אלקטרוני לכתובת הדואר הזו. בבקשה עקוב אחרי הוראות האישור שם."},"change_avatar":{"title":"שנה את האוואטר שלך","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, מבוסס על","refresh_gravatar_title":"רענון האווטר שלכם","letter_based":"אווטר שהוגדרר על ידי המערכת","uploaded_avatar":"תמונה אישית","uploaded_avatar_empty":"הוסף תמונה אישית","upload_title":"העלה את התמונה שלך","upload_picture":"העלאת תמונה","image_is_not_a_square":"אזהרה: חתכנו את התמונה שלך, היא לא ריבועית"},"change_profile_background":{"title":"שינוי רקע פרופיל"},"email":{"title":"דואר אלקטרוני","ok":"נראה טוב, נשלח לך דואר אלקטרוני לאישור.","invalid":"בבקשה הכנס כתובת דואר אלקטרוני חוקית","authenticated":"כתובת הדואר האלקטרוני שלך אושרה על ידי {{provider}}.","frequency":"נשלח לך דואר אלקטרוני רק אם לא ראינו אותך לאחרונה ועדיין לא ראית את מה שאנחנו רוצים לשלוח"},"name":{"title":"שם","too_short":"השם שלך קצר מידי.","ok":"השם נראה טוב."},"username":{"title":"שם משתמש","short_instructions":"אנשים יכולים לאזכר אותך כ @{{username}}.","available":"שם המשתמש שלך פנוי.","global_match":"הדואר האלקטרוני תואם את שם המשתמש הרשום","global_mismatch":"כבר רשום. נסה {{suggestion}}?","not_available":"לא זמין. נסה {{suggestion}}?","too_short":"שם המשתמש שלך קצר מידי.","too_long":"שם המשתמש שלך ארוך מידי.","checking":"בודק זמינות שם משתמש...","enter_email":"נמצא שם משתמש. הכנס דואר אלקטרוני תואם.","prefilled":"הדואר האלקטרוני תואם את שם המשתמש הזה."},"locale":{"title":"שפת ממשק","default":"(ברירת מחדל)"},"password_confirmation":{"title":"סיסמה שוב"},"last_posted":"הודעה אחרונה","last_emailed":"נשלח לאחרונה בדואר אלקטרוני","last_seen":"נראה","created":"הצטרף","log_out":"התנתקות","location":"מיקום","website":"אתר","email_settings":"דואר אלקטרוני","email_digests":{"title":"כשאת/ה לא מבקר באתר, שלח סיכום בדואר אלקטרוני של מה חדש","daily":"יומית","weekly":"שבועית","bi_weekly":"דו-שבועית"},"email_direct":"קבל דואר אלקטרוני כשמישהו מצטט אותך, מגיב להודעה שלך, או מזכיר את ה @שם שלך","email_private_messages":"קבל דואר אלקטרוני כשמישהו שולח לך הודעה פרטית","other_settings":"אחר","categories_settings":"קטגוריות","new_topic_duration":{"label":"החשב נושא חדש כאשר","not_viewed":"עדיין לא צפית בהם","last_here":"נוצר(ו) מאז שהייתם כאן לאחרונה","after_n_days":{"one":"נוצר ביום האחרון","other":"נוצרו ב-{{count}} ימים האחרונים"},"after_n_weeks":{"one":"נוצר/ו בשבוע האחרון","other":"נוצר/ו ב-{{count}} שבועות האחרונים"}},"auto_track_topics":" מעקב אוטומטי אחרי נושאים אליהם אני נכנס/ת","auto_track_options":{"never":"אף פעם","always":"תמיד","after_n_seconds":{"one":"אחרי שנייה אחת","other":"אחרי {{count}} שניות"},"after_n_minutes":{"one":"אחרי דקה אחת","other":"אחרי {{count}} שניות"}},"invited":{"search":"הקלידו כדי לחפש הזמנות...","title":"הזמנות","user":"משתמש/ת שהוזמנו","none":"עוד לא הזמנת לכאן אף אחד.","truncated":"מראה את  {{count}} ההזמנות הראשונות.","redeemed":"הזמנות נוצלו","redeemed_at":"נפדו ב","pending":"הזמנות ממתינות","topics_entered":"נושאים נצפו","posts_read_count":"הודעות נקראו","expired":"פג תוקף ההזמנה.","rescind":"הסרה","rescinded":"הזמנה הוסרה","time_read":"זמן קריאה","days_visited":"מספר ימי ביקור","account_age_days":"גיל החשבון בימים","create":"שליחת הזמנה","bulk_invite":{"none":"נכון לעכשיו לא הזמנת לכאן אף אחד. תוכלו לשלוח הזמנות אישיות, או להזמין כמה אנשים בבת אחת באמצעות   \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003e העלאת קובץ הזמנה קבוצתית\u003c/a\u003e.","text":"הזמנה קבוצתית מקובץ","uploading":"מעלה נתונים","success":"הקובץ הועלה בהצלחה, תקבל/י התראה תוך זמן קצר בנוגע להתקדמות.","error":"חלה תקלה בהעלאת \"'{{filename}}': \n{{message}}"}},"password":{"title":"סיסמה","too_short":"הסיסמה שלך קצרה מידי.","common":"הסיסמה הזו נפוצה מידי.","ok":"הסיסמה שלך נראית טוב.","instructions":"יש להכיל לפחות %{count} תווים."},"ip_address":{"title":"כתובת IP אחרונה"},"registration_ip_address":{"title":"כתובת IP בהרשמה"},"avatar":{"title":"אוואטר"},"title":{"title":"כותרת"},"filters":{"all":"הכל"},"stream":{"posted_by":"פורסם על ידי","sent_by":"נשלח על ידי","private_message":"הודעה פרטית","the_topic":"הנושא"}},"loading":"טוען...","errors":{"prev_page":"בזמן הניסיון לטעון","reasons":{"network":"שגיאת רשת","unknown":"תקלה"},"desc":{"network":"אנא בדקו את ההתקשרות שלכם","network_fixed":"נראה שזה חזר לעבוד.","unknown":"משהו השתבש."},"buttons":{"back":"חזרה","again":"ניסיון נוסף","fixed":"טעינת עמוד"}},"close":"סגור","assets_changed_confirm":"האתר עבר עדכון. תרצו לרענן לגרסא המתקדמת ביותר?","read_only_mode":{"enabled":"מצב קריאה בלבד למנהל ראשי. ניתן להמשיך לקרוא באתר אבל פעולות לא יעבדו כראוי.","login_disabled":"התחברות אינה מתאפשרת כשהאתר במצב קריאה בלבד."},"learn_more":"למד עוד...","year":"שנה","year_desc":"נושאים שפורסמו ב-365 הימים האחרונים","month":"חודש","month_desc":"נושאים שפורסמו ב-30 הימים האחרונים","week":"שבוע","week_desc":"נושאים שפורסמו ב-7 הימים האחרונים","day":"יום","first_post":"הודעה ראשונה","mute":"השתק","unmute":"בטל השתקה","last_post":"הודעה אחרונה","last_post_lowercase":"פרסום אחרון","summary":{"description":"ישנן \u003cb\u003e {{count}}\u003c/b\u003e תגובות","description_time":"ישנן  \u003cb\u003e{{count}}\u003c/b\u003e תגובות, עם הערכת זמן קריאה של כ- \u003cb\u003e{{readingTime}}  דקות \u003c/b\u003e.","enable":"סכם נושא זה","disable":"הצג את כל ההודעות"},"deleted_filter":{"enabled_description":"נושא זה מכיל פרסומים שנמחקו, אשר הוסתרו.","disabled_description":"פרסומים שנמחקו בנושא זה מוצגים כעת.","enable":"הסתר פוסטים מחוקים"},"private_message_info":{"title":"הודעה פרטית","invite":"הזמינו אחרים...","remove_allowed_user":"האם באמת להסיר את {{name}} מההודעה הפרטית הזו?"},"email":"דוא\"ל","username":"שם משתמש","last_seen":"נצפה","created":"נוצר","created_lowercase":"נוצר/ו","trust_level":"רמת אמון","search_hint":"שם משתמש/ת או כתובת דוא\"ל","create_account":{"title":"יצירת חשבון חדש","failed":"משהו לא בסדר, אולי כבר קיימת כתובת דואר אלקטרוני כזו. נסה את קישור שכחתי סיסמה."},"forgot_password":{"title":"שכחתי סיסמה","action":"שכחתי את הסיסמה שלי","invite":"הזן שם משתמש או כתובת דואר אלקטרוני ונשלח לך קישור לאיפוס סיסמה","reset":"איפוס סיסמה","complete_username":"אם קיים חשבון שמתאים לשם המשתמש \u003cb\u003e%{username}\u003c/b\u003e, אתה אמור לקבל בקרוב מייל עם הוראות לאיפוס הסיסמא. ","complete_email":"אם החשבון מתאים ל \u003cb\u003e%{email}\u003c/b\u003e, אתה אמור לקבל בקרוב מעעל עם הוראות לאיפוס הסיסמא."},"login":{"title":"התחברות","username":"משתמש","password":"סיסמה","email_placeholder":"דואר אלקטרוני או סיסמה","caps_lock_warning":"מקש Caps Lock לחוץ","error":"שגיאה לא ידועה","blank_username_or_password":"אנא הקישור את כתובת הדוא\"ל או שם המשתמש/ת שלכם וסיסמא.","reset_password":"אפס סיסמה","logging_in":"מתחבר....","or":"או","authenticating":"מאשר...","awaiting_confirmation":"החשבון שלך ממתין להפעלה. ניתן להשתמש בקישור \"שכחתי סיסמה\" כדי לשלוח דואר אלקטרוני נוסף.","awaiting_approval":"החשבון שלך עדיין לא אושר על ידי חבר צוות. יישלח אליך דואר אלקטרוני כשהוא יאושר.","requires_invite":"סליחה, גישה לפורום הזה היא בהזמנה בלבד.","not_activated":"אינך יכול להתחבר עדיין. שלחנו לך דואר אלקטרוני להפעלת החשבון לכתובת: \u003cb\u003e{{sentTo}}\u003c/b\u003e. יש לעקוב אחר ההוראות בדואר כדי להפעיל את החשבון.","resend_activation_email":"יש ללחוץ כאן לשליחת דואר אלקטרוני חוזר להפעלת החשבון.","sent_activation_email_again":"שלחנו לך הודעת דואר אלקטרוני נוספת להפעלת החשבון לכתובת \u003cb\u003e{{currentEmail}}\u003c/b\u003e. זה יכול לקחת כמה דקות עד שיגיע, לא לשכוח לבדוק את תיבת דואר הזבל.","google":{"title":"עם גוגל","message":"התחברות עם גוגל (יש לוודא שחוסם חלונות קופצים אינו פעיל)"},"google_oauth2":{"title":"בעזרת Google","message":"התחברות מאובטחת באמצעות גוגל (בדקו שחוסם החלונות הקופצים שלכם אינו מופעל)"},"twitter":{"title":"עם Twitter","message":"התחברות עם Twitter (יש לוודא שחוסם חלונות קופצים אינו פעיל)"},"facebook":{"title":"עם Facebook","message":"התחברות עם Facebook (יש לוודא שחוסם חלונות קופצים אינו פעיל)"},"yahoo":{"title":"עם Yahoo","message":"התחברות עם יאהו (יש לוודא שחוסם חלונות קופצים אינו פעיל)"},"github":{"title":"עם GitHub","message":"התחברות עם GitHub (יש לוודא שחוסם חלונות קופצים אינו פעיל)"}},"composer":{"posting_not_on_topic":"לאיזה נושא רצית להגיב?","saving_draft_tip":"שומר","saved_draft_tip":"נשמר","saved_local_draft_tip":"נשמר מקומית","similar_topics":"הנושא שלך דומה ל...","drafts_offline":"טיוטות מנותקות","min_length":{"need_more_for_title":"{{n}} תווים נשארו לכותרת","need_more_for_reply":"{{n}} תווים נשארו להודעה"},"error":{"title_missing":"יש להזין כותרת.","title_too_short":"על הכותרת להיות באורך {{min}} תווים לפחות.","title_too_long":"על הכותרת להיות באורך {{max}} לכל היותר.","post_missing":"ההודעה אינה יכולה להיות ריקה.","post_length":"על ההודעה להיות באורך {{min}} תווים לפחות.","category_missing":"עליך לבחור קטגוריה."},"save_edit":"שמירת עריכה","reply_original":"תגובה לנושא המקורי","reply_here":"תגובה כאן","reply":"תגובה","cancel":"ביטול","create_topic":"יצירת נושא","create_pm":"יצירת הודעה פרטית","title":"או לחץ Ctrl+Enter","users_placeholder":"הוספת משתמש","title_placeholder":" במשפט אחד, במה עוסק הדיון הזה?","edit_reason_placeholder":"מדוע ערכת?","show_edit_reason":"(הוספת סיבת עריכה)","reply_placeholder":"יש להקליד כאן. ניתן להשתמש ב Markdown או BBCode כדי להתאים את הטקסט. גרירת או הדבקת תמונה תעלה אותה.","view_new_post":"הצגת את ההודעה החדשה שלך.","saving":"שומר...","saved":"נשמר!","uploading":"מעלה...","show_preview":"הראה תצוגה מקדימה \u0026raquo;","hide_preview":"\u0026laquo; הסתר תצוגה מקדימה","quote_post_title":"ציטוט הודעה בשלמותה","bold_title":"מודגש","bold_text":"טקסט מודגש","italic_title":"נטוי","italic_text":"טקסט נטוי","link_title":"קישור","link_description":"הזן תיאור קישור כאן","link_dialog_title":"הזן קישור","link_optional_text":"כותרת אופציונלית","quote_title":"ציטוט","quote_text":"ציטוט","code_title":"טקסט מעוצב","code_text":"הזחה של הטקסט ב-4 רווחים","upload_title":"העלאה","upload_description":"הזן תיאור העלאה כאן","olist_title":"רשימה ממוספרת","ulist_title":"רשימת נקודות","list_item":"פריט ברשימה","heading_title":"כותרת","heading_text":"כותרת","hr_title":"קו אופקי","undo_title":"בטל","redo_title":"חזור","help":"עזרה על כתיבה ב-Markdown","toggler":"הסתר או הצג את פאנל העריכה","admin_options_title":"אפשרויות צוות אופציונליות לנושא זה","auto_close_label":"זמן סגירת נושא אוטומטית:","auto_close_units":"(מספר שעות, זמן, חותמת זמן)","auto_close_examples":"הזן זמן מוחלט או מספר שעות — 24, 17:00, 2013-11-22 14:00","auto_close_error":"אנא הזן ערך חוקי."},"notifications":{"title":"התראות של אזכורי @שם, תגובות להודעות ונושאים שלך, הודעות פרטיות וכיו\"ב","none":"אין לך התרעות כרגע.","more":"הצג התרעות ישנות יותר","total_flagged":"סך הכל נושאים מדוגללים","mentioned":"\u003ci title='mentioned' class='icon'\u003e@\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='quoted' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='edited' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='accepted your invitation' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e אישר/ה את הזמנתך\u003c/p\u003e","moved_post":"\u003ci title='moved post' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e הזיז/ה {{description}}\u003c/p\u003e","linked":"\u003ci title='linked post' class='fa fa-arrow-left'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e"},"upload_selector":{"title":"הוספת תמונה","title_with_attachments":"הוספת תמונה או קובץ","from_my_computer":"מהמחשב שלי","from_the_web":"מהאינטרנט","remote_tip":"קישור לתמונה http://example.com/image.jpg","remote_tip_with_attachments":"קישור לתמונה או קובץ http://example.com/file.ext (סיומות מותרות: {{authorized_extensions}}).","local_tip":"לחץ לבחירת תמונה מהמכשיר שלך","local_tip_with_attachments":"לחץ לבחירת תמונה או קובץ מהמכשיר שלך (סיומות מותרות: {{authorized_extensions}})","hint":"(ניתן גם לגרור לעורך להעלאה)","hint_for_supported_browsers":"(אתה יכול גם לעשות drag and drop או להדביק תמונות אל תוך העורך כדי להעלות אותן)","uploading":"מעלה","image_link":"קישור לתמונה יצביע ל"},"search":{"title":"חיפוש נושאים, פרסומים, משתמשים או קטגוריות","no_results":"אין תוצאות.","searching":"מחפש ...","context":{"user":"חיפוש פרסומים לפי @{{username}}","category":"חיפוש בקטגוריה \"{{category}}\"","topic":"חפשו בנושא זה"}},"site_map":"לך לרשימת נושאים או קטגוריה אחרת","go_back":"חזור אחורה","not_logged_in_user":"עמוד משתמש עם סיכום פעילות נוכחית והעדפות","current_user":"לך לעמוד המשתמש שלך","starred":{"title":"כוכב","help":{"star":"הוספת נושא זה לרשימת הכוכבים שלך","unstar":"הסרת נושא זה מרשימת הכוכבים שלך"}},"topics":{"bulk":{"reset_read":"איפוס נקראו","delete":"מחיקת נושאים","dismiss_posts":"ביטול פרסומים","dismiss_posts_tooltip":"ניקוי ספירת הלא-נקראים בנושאים אלו, תווך המשך הצגתם ברשימת הלא נקראים כאשר נוספים פרסומים חדשים","dismiss_topics":"דחיית נושאים","dismiss_topics_tooltip":"הפסקת הצגת נושאים אלו ברשימת הלא-נקראו האישית כאשר נוספים פרסומים חדשים","dismiss_new":"שחרור חדשים","toggle":"החלף קבוצה מסומנת של נושאים","actions":"מקבץ פעולות","change_category":"שינוי קטגוריה","close_topics":"סגירת נושאים","notification_level":"שינוי רמת התרעה","selected":{"one":"בחרת נושא \u003cb\u003eאחד\u003c/b\u003e.","other":"בחרת \u003cb\u003e{{count}}\u003c/b\u003e נושאים."}},"none":{"starred":"עדיין לא סימנת בכוכב אף נושא. כדי לסמן נושא בכוכב, יש ללחוץ על הכוכב ליד הכותרת.","unread":"אין לך נושאים שלא נקראו.","new":"אין לך נושאים חדשים.","read":"עדיין לא קראת אף נושא.","posted":"עדיין לא פרסמת באף נושא.","latest":"אין נושאים מדוברים. זה עצוב.","hot":"אין נושאים חמים.","category":"אין נושאים בקטגוריה {{category}}.","top":"אין נושאים מובילים."},"bottom":{"latest":"אין עוד נושאים מדוברים.","hot":"אין עוד נושאים חמים.","posted":"אין עוד נושאים שפורסמו.","read":"אין עוד נושאים שנקראו.","new":"אין עוד נושאים חדשים.","unread":"אין עוד נושאים שלא נקראו.","starred":"אין עוד נושאים עם כוכבים.","category":"אין עוד נושאים בקטגוריה {{category}}.","top":"אין עוד נושאים מובילים."}},"topic":{"filter_to":"{{post_count}} הודעות בנושא","create":"יצירת נושא","create_long":"יצירת נושא חדש","private_message":"התחלת הודעה פרטית","list":"נושאים","new":"נושא חדש","unread":"לא נקרא/ו","new_topics":{"one":"נושא חדש אחד","other":"{{count}} נושאים חדשים"},"unread_topics":{"one":"1 שלא נקרא","other":"{{count}} נושאים שלא נקראו"},"title":"נושא","loading_more":"טוען עוד נושאים...","loading":"טוען נושא...","invalid_access":{"title":"הנושא פרטי","description":"סליחה, איך אין לך גישה לנושא הזה!","login_required":"עליכם להתחבר כדי לצפות בנושא זה."},"server_error":{"title":"שגיאה בטעינת נושא","description":"סליחה, לא יכולנו לטעון את הנושא הזה, ייתכן שבשל תקלת תקשורת. אנא נסי שוב. אם הבעיה נמשכת, הודיעו לנו."},"not_found":{"title":"נושא לא נמצא","description":"סליחה, לא יכולנו למצוא את הנושא הזה. אולי הוא הוסר על ידי מנהל?"},"total_unread_posts":{"one":"יש לכם פרסום אחד שלא נקרא בנושא זה","other":"יש לכם {{count}} פרסומים שלא נקראו בנושא זה"},"unread_posts":{"one":"יש לך הודעה אחת שלא נקראה בנושא הזה","other":"יש לך {{count}} הודעות ישנות שלא נקראו בנושא הזה"},"new_posts":{"one":"יש הודעה אחת חדשה בנושא הזה מאז שקראת אותו לאחרונה","other":"יש {{count}} הודעות חדשות בנושא הזה מאז שקראת אותו לאחרונה"},"likes":{"one":"יש לייק אחד בנושא הזה","other":"יש {{count}} לייקים בנושא הזה"},"back_to_list":"חזרה לרשימת נושאים","options":"אפשרויות נושא","show_links":"הצג קישורים בתוך הנושא הזה","toggle_information":"הצגת פרטי נושא","read_more_in_category":"רוצה לקרוא עוד? עיין נושאים אחרים ב {{catLink}} או {{latestLink}}.","read_more":"רוצה לקרוא עוד? {{catLink}} or {{latestLink}}.","browse_all_categories":"עיין בכל הקטגוריות","view_latest_topics":"הצגת נושאים מדוברים","suggest_create_topic":"מדוע לא ליצור נושא?","jump_reply_up":"קפיצה לתגובה קודמת","jump_reply_down":"קפיצה לתגובה מאוחרת","deleted":"הנושא הזה נמחק","auto_close_notice":"הנושא הזה ינעל אוטומטית %{timeLeft}.","auto_close_title":"הגדרות נעילה אוטומטית","auto_close_save":"שמור","auto_close_remove":"אל תנעל נושא זה אוטומטית","progress":{"title":"התקדמות נושא","go_top":"למעלה","go_bottom":"למטה","go":"קדימה","jump_bottom_with_number":"קפיצה להודעה %{post_number}","total":"סך הכל הודעות","current":"הודעה נוכחית","position":"הודעה %{current} מתוך %{total}"},"notifications":{"reasons":{"3_6":"תקבלו התרעות כיוון שאת/ה צופה בקטגוריה הזו.","3_5":"תקבל/י התרעות כיוון שהתחלת לצפות בנושא הזה אוטומטית.","3_2":"תקבל/י התרעות כיוון שאת/ה צופים בנושא הזה.","3_1":"תקבל/י התרעות כיוון שאת/ה יצרת את הנושא הזה.","3":"תקבל/י התרעות כיוון שאת/ה צופה בנושא הזה.","2_8":"תקבלו התרעות כיוון שאת/ה צופה בקטגוריה הזו.","2_4":"תקבל/י התרעות כיוון שפרסמת תגובה לנושא הזה.","2_2":"תקבל/י התרעות כיוון שאת/ה עוקב/ת אחרי הנושא הזה.","2":"תקבל/י התרעות כיוון ש\u003ca href=\"/users/{{username}}/preferences\"\u003eקראת את הנושא הזה\u003c/a\u003e.","1_2":"תקבל/י התרעה רק אם מישהו מזכיר אותך עם @שם_משתמש או מגיב להודעה שלך.","1":"תקבל/י התרעה רק אם מישהו מזכיר אותך עם @שם_משתמש או הגיבו להודעה שלך.","0_7":"את/ה מתעלם/מתעלמת מכל ההתרעות בקטגוריה זו.","0_2":"אתה מתעלם מכל ההתרעות בנושא זה.","0":"אתה מתעלם מכל ההתרעות בנושא זה."},"watching_pm":{"title":"צופה","description":"תקבלו עדכון על כל פרסום חדש בהתכתבות הפרטית הזו. סך ההודעות החדשות ואלו שלא נקראו יופיע גם לצד שם הנושא."},"watching":{"title":"צופה","description":"תקבלו התראה על כל הודעה חדשה בנושא זה סף הפרסומים שלא נקראו והפרסומים החדשים יופיע גם כן לצד שם הנושא."},"tracking_pm":{"title":"עוקב","description":"סך הפרסומים החדשים ואלה שלא נקראו יופיע לצד המסר הפרטי. תקבלו התראה רק אם מישהו יזכיר את @שם_המשתמש שלכם או ישיב לפרסומים שלכם."},"tracking":{"title":"עוקב","description":"מספר ההודעות החדשות ואלו שלא נקראו יופיע לצד שם הנושא. תקבלו התראה רק אם מישהו יזכיר את @שם_המשתמש שלכם או ישיבו להודעותיכם."},"regular":{"title":"רגיל","description":"תקבל/י הודעה רק אם מישהו מזכיר אותך עם @שם_המשתמש או מגיבים להודעה שלך."},"regular_pm":{"title":"רגיל","description":"תקבל/י התראה רק אם מישהו מזכיר/ה את @שם_המשתמש או מגיב לך על פוסט באופן פרטי"},"muted_pm":{"title":"מושתק","description":"לעולם לא תקבל/י התרעות על כל הקשור להודעה פרטית זו."},"muted":{"title":"מושתק","description":"לעולם לא תקבל/י התרעות על הנושא הזה, והוא לא יופיע בעמוד הלא נקראו שלך."}},"actions":{"recover":"שחזר נושא","delete":"מחק נושא","open":"פתח נושא","close":"נעל נושא","auto_close":"נעילה אוטומטית","make_banner":"נושא הבאנר","remove_banner":"הסרת נושא הבאנר","unpin":"בטל נעיצת נושא","pin":"נעץ נושא","pin_globally":"נעץ נושא גלובלית","unarchive":"הוצא נושא מארכיון","archive":"הכנס נושא לארכיון","invisible":"הפוך בלתי נראה","visible":"הפוך נראה","reset_read":"אפס מידע שנקרא","multi_select":"בחר הודעות"},"reply":{"title":"תגובה","help":"החל בכתיבת הודעה לנושא זה"},"clear_pin":{"title":"נקה נעיצה","help":"נקה סטטוס נעוץ של נושא זה כדי שהוא לא יופיע עוד בראש רשימת הנושאים שלך"},"share":{"title":"שיתוף","help":"שתפו קישור לנושא זה"},"flag_topic":{"title":"סימון","help":"סמנו נושא זה באופן פרטי לתשומת לב או שלחו התרעה פרטית בנוגע אליו","success_message":"סמנת נושא זה בהצלחה."},"inviting":"מזמין...","automatically_add_to_groups_optional":"הזמנה זו כוללת גישה לקבוצות הללו: (אופציונלי, רק מנהל/ת)","automatically_add_to_groups_required":"הזמנה זו כוללת גישה לקבוצות הללו: (\u003cb\u003eחובה\u003c/b\u003e, רק מנהל/ת)","invite_private":{"title":"הזמנה להודעה פרטית","email_or_username":"כתובת דואר אלקטרוני או שם משתמש של המוזמן","email_or_username_placeholder":"כתובת דואר אלקטרוני או שם משתמש","action":"הזמנה","success":"הזמנו את המשתמש/ת להשתתף בשיחה פרטית זו.","error":"סליחה, הייתה שגיאה בהזמנת משתמש זה.","group_name":"שם הקבוצה"},"invite_reply":{"title":"הזמנה","action":"הזמנה באמצעות דואר אלקטרוני","help":"שלח הזמנה לחברים כדי שהם יוכלו להגיב לנושא בלחיצה אחת","to_topic":"נשלח מייל קצר המאפשר לחברך להצטרף באופן מיידי ולהשיב לנושא באמצעות לחיצה על קישור, ללא צורך להירשם למערכת הפורומים.","to_forum":"נשלח מייל קצר המאפשר לחברך להצטרף באופן מיידי באמצעות לחיצה על קישור, ללא צורך בהתחברות למערכת הפורומים.","email_placeholder":"name@example.com","success":"שלחנו הזמנה אל  \u003cb\u003e{{email}}\u003c/b\u003e. נודיע לך כאשר ההזמנה תתקבל. בדקו את לשונית ההזמנות בעמוד המשתמש/ת שלך כדי לעקוב אחר ההזמנות ששלחת.","error":"סליחה, לא יכולנו להזמין את האדם הזה, אולי הוא כבר רשום?"},"login_reply":"התחברו כדי להשיב","filters":{"n_posts":{"one":"הודעה אחת","other":"{{count}} הודעות"},"cancel":"הצג שוב את כל ההודעות בנושא זה."},"split_topic":{"title":"העבר לנושא חדש","action":"העבר לנושא חדש","topic_name":"שם הנושא החדש","error":"הייתה שגיאה בהעברת ההודעות לנושא החדש.","instructions":{"one":"אתה עומד ליצור נושא חדש ולמלא אותו עם ההודעה שבחרת.","other":"אתה עומד ליצור נושא חדש ולמלא אותו עם \u003cb\u003e{{count}}\u003c/b\u003e ההודעות שבחרת."}},"merge_topic":{"title":"העבר לנושא קיים","action":"העבר לנושא קיים","error":"התרחשה שגיאה בהעברת ההודעות לנושא הזה.","instructions":{"one":"בבקשה בחר נושא אליו הייתי רוצה להעביר את ההודעה","other":"בבקשה בחר את הנושא אליו תרצה להעביר את  \u003cb\u003e{{count}}\u003c/b\u003e ההודעות."}},"change_owner":{"title":"שנה בעלים של הודעות","action":"שנה בעלות","error":"התרחשה שגיאה בשינוי הבעלות של ההדעות.","label":"בעלים חדש של ההודעות","placeholder":"שם המשתמש של הבעלים החדש","instructions":{"one":"אנא בחר את הבעלים החדש של ההודעות מאת \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"אנא בחר את הבעלים החדש של {{count}} ההודעות מאת \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"יש לשים לב שהתרעות על הודעה זו יועברו למשתמש החדש רטרואקטיבית.\u003cbr\u003eזהירות: כרגע, שום מידע תלוי-הודעה אינו מועבר למשתמש החדש. השתמשו בזהירות."},"multi_select":{"select":"בחירה","selected":"נבחרו ({{count}})","select_replies":"נבחרו +תגובות","delete":"מחק נבחרים","cancel":"בטל בחירה","select_all":"בחר הכל","deselect_all":"בחר כלום","description":{"one":"בחרת הודעה אחת.","other":"בחרת \u003cb\u003e{{count}}\u003c/b\u003e הודעות."}}},"post":{"reply":"מגיב ל {{link}} מאת {{replyAvatar}} {{username}}","reply_topic":"תגובה ל {{link}}","quote_reply":"תגובה עם ציטוט","edit":"עורך את {{link}} מאת {{replyAvatar}} {{username}}","edit_reason":"סיבה: ","post_number":"הודעה {{number}}","in_reply_to":"השב ל","last_edited_on":"הודעה נערכה לאחרונה ב","reply_as_new_topic":"תגובה כנושא חדש","continue_discussion":"ממשיך את הדיון מ {{postLink}}:","follow_quote":"מעבר להודעה המצוטטת","show_full":"הראה הודעה מלאה","show_hidden":"הצגת תוכן מוסתר.","deleted_by_author":{"one":"(ההודעה בוטלה על ידי הכותב, היא תמחק אוטומטית בעוד %{count} שעות אלא אם תסומן בדגל)","other":"(ההודעה בוטלה על ידי הכותב/ת, היא תמחק אוטומטית בעוד %{count} שעות אלא אם כן היא תסומן )"},"expand_collapse":"הרחב/צמצם","gap":{"one":"הודעה אחת נסתרת","other":"{{count}} הודעות נסתרות"},"more_links":"עוד {{count}}...","unread":"הפוסט טרם נקרא","has_replies":{"one":"תגובה","other":"תגובות"},"errors":{"create":"סליחה, הייתה שגיאה ביצירת ההודעה שלך. אנא נסה שנית.","edit":"סליחה, הייתה שגיאה בעריכת ההודעה שלך. אנא נסה שנית.","upload":"סליחה, הייתה שגיאה בהעלאת הקובץ שלך. אנא נסה שנית","attachment_too_large":"סליחה, אך הקובץ שאתה מנסה להעלות גדול מידי (הגודל המקסימלי הוא {{max_size_kb}}kb).","image_too_large":"סליחה, אך התמונה שאתה מנסה להעלות גדולה מידי. (הגודל המקסימלי הוא {{max_size_kb}}kb), אנא שנה את הגודל ונסה שנית.","too_many_uploads":"סליחה, אך ניתן להעלות רק קובץ אחת כל פעם.","upload_not_authorized":"סליחה, אך סוג הקובץ שאתה מנסה להעלות אינו מורשה (סיומות מורשות: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"סליחה, משתמשים חדשים לא יכולים להעלות תמונות.","attachment_upload_not_allowed_for_new_user":"סליחה, משתמשים חדשים לא יכולים להעלות קבצים."},"abandon":{"confirm":"האם אתה רוצה לנטוש את ההודעה שלך?","no_value":"לא, שמור אותה","yes_value":"כן, נטוש"},"archetypes":{"save":"שמור אפשרויות"},"controls":{"reply":"התחל לכתוב תגובה להודעה זו","like":"תן לייק להודעה זו","has_liked":"אהבת פוסט זה","undo_like":"בטל 'אהוב'","edit":"ערוך הודעה זו","flag":"סימון הודעה זו באופן פרטי לתשומת לב או שלח התרעה פרטית עליה","delete":"מחק הודעה זו","undelete":"שחזר הודעה זו","share":"שיתוף קישור להודעה זו","more":"עוד","delete_replies":{"confirm":{"one":"אתה רוצה למחוק את התגובה הישירה להודעה זו?","other":"אתה רוצה למצחוק את {{count}} התגובות הישירות להודעה זו?"},"yes_value":"כן, מחק גם את התגובות","no_value":"לא, רק את ההודעה"},"admin":"פרסום פעולות מנהל/ת","wiki":"הודעת Wiki","unwiki":"הודעת Unwiki"},"actions":{"flag":"סימון","defer_flags":{"one":"דחיית סימון","other":"דחיית סימונים"},"it_too":{"off_topic":"דגלל גם את זה","spam":"סמנו גם את זה","inappropriate":"סמנו גם את זה","custom_flag":"סמנו גם את זה","bookmark":"העדף גם את זה","like":"תן לייק גם לזה","vote":"הצבע גם לזה"},"undo":{"off_topic":"ביטול סימון","spam":"ביטול סימון","inappropriate":"ביטול סימון","bookmark":"בטל העדפה","like":"בטל לייק","vote":"בטל הצבעה"},"people":{"off_topic":"{{icons}} סומן כמחוץ לנושא","spam":"{{icons}} סומן כספאם","inappropriate":"{{icons}} סומן בלתי ראוי","notify_moderators":"{{icons}} הודיעו למנהלים","notify_moderators_with_url":"{{icons}} \u003ca href='{{postUrl}}'\u003eהודיעו למנהלים\u003c/a\u003e","notify_user":"{{icons}} שלחו הודעה פרטית","notify_user_with_url":"{{icons}} שלחו \u003ca href='{{postUrl}}'\u003eהודעה פרטית\u003c/a\u003e","bookmark":"{{icons}} סימנו כמועדף","like":"{{icons}} נתנו לייק","vote":"{{icons}} הצביעו עבור זה"},"by_you":{"off_topic":"סמ נת פרסום זה כמחוץ לנושא","spam":"סמנת את זה כספאם","inappropriate":"סמנת את זה כלא ראוי","notify_moderators":"סמנת את זה עבור המנהלים","notify_user":"שלחת הודעה פרטית למשתמש הזה","bookmark":"סימנת הודעה זו כמועדפת","like":"נתת לזה לייק","vote":"הצבעת להודעה זו"},"by_you_and_others":{"off_topic":{"one":"אתה ועוד אחד דגללתם את זה כאוף-טופיק","other":"את/ה ועוד {{count}} אנשים אחרים סמנתם את זה כמחוץ לנושא"},"spam":{"one":"אתה ועוד אחד דגללתם את זה כספאם","other":"את/ה ועוד {{count}} אנשים אחרים סמנתם את זה כספאם"},"inappropriate":{"one":"אתה ועוד אחד דגלתתם את זה כלא ראוי","other":"את/ה ועוד {{count}} אנשים אחרים סמנתם את זה כלא ראוי"},"notify_moderators":{"one":"אתה ועוד אחד דגללתם את זה עבור ניהול","other":"את/ה ועוד {{count}} אנשים אחרים סמנתם את זה לניהול"},"notify_user":{"one":"אתה ועוד אחד שלחתם הודעה פרטית למשתמש זה","other":"אתה ועוד {{count}} אנשים אחרים שלחתם הודעה פרטית למשתמש זה"},"bookmark":{"one":"אתה ועוד אחד סימנתם הודעה זו כמועדפת","other":"אתה ועוד {{count}} אנשים אחרים סימנתם הודעה זו כמועדפת"},"like":{"one":"אתה ועוד אחד נתתם לייק לזה","other":"אתה ועוד {{count}} אנשים אחרים נתתם לייק לזה"},"vote":{"one":"אתה ועוד אחד הצבעת להודעה זו","other":"אתה ועוד {{count}} אנשים אחרים הצבעתם להודעה זו"}},"by_others":{"off_topic":{"one":"אדם אחד דגלל את זה כאוף-טופיק","other":"{{count}} אנשים סמנו את זה כאוף-טופיק"},"spam":{"one":"אדם אחד דגלל את זה כספאם","other":"{{count}} אנשים סמנו את זה כספאם"},"inappropriate":{"one":"אדם אחד דגלל את זה כלא ראוי","other":"{{count}} אנשים סמנו את זה כלא ראוי"},"notify_moderators":{"one":"אדם אחד דגלל את זה לניהול","other":"{{count}} אנשים סמנו את זה לניהול"},"notify_user":{"one":"אדם אחד שלח הודעה פרטית למשתמש הזה","other":"{{count}} אנשים שלחו הודעה פרטית למשתמש הזה"},"bookmark":{"one":"אדם אחד סימן הודעה זו כמועדפת","other":"{{count}} אנשים סימנו הודעה זו כמועדפת"},"like":{"one":"אדם אחד נתן לזה לייק","other":"{{count}} אנשים נתנו לזה לייק"},"vote":{"one":"אדם אחד הצביע להודעה זו","other":"{{count}} אנשים הצביעו להודעה זו"}}},"edits":{"one":"עריכה אחת","other":"{{count}} עריכות","zero":"אין עריכות"},"delete":{"confirm":{"one":"Are you sure you want to delete that post?","other":"Are you sure you want to delete all those posts?"}},"revisions":{"controls":{"first":"מהדורה ראשונה","previous":"מהדורה קודמת","next":"מהדורה באה","last":"מהדורה אחרונה","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e מול \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"הצג את הפלט עם תוספות והסרות בתוכו","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"הצג את הפרשי הפלט אחד ליד השני","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"הצג את עורך הפרשי מקור Markdown אחד ליד השני","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Markdown"}},"details":{"edited_by":"נערך על ידי"}}},"category":{"can":"יכול\u0026hellip; ","none":"(ללא קטגוריה)","choose":"בחר קטגוריה\u0026hellip;","edit":"ערוך","edit_long":"עריכה","view":"הצג נושאים בקטגוריה","general":"כללי","settings":"הגדרות","delete":"מחק קטגוריה","create":"צור קטגוריה","save":"שמור קטגוריה","creation_error":"ארעה שגיאה במהלך יצירת הקטגוריה הזו.","save_error":"ארעה שגיאה בשמירת הקטגוריה הזו","name":"שם הקטגוריה","description":"תיאור","topic":"נושא הקטגוריה","logo":"תמונת לוגו לקטגוריה","background_image":"תמונת רקע לקטגוריה","badge_colors":"צבעי התג","background_color":"צבע רקע","foreground_color":"צבע קדמי","name_placeholder":"מילה או שתיים לכל היותר","color_placeholder":"כל צבע אינטרנטי","delete_confirm":"האם אתה בטוח שברצונך למחוק את הקטגוריה הזו?","delete_error":"ארעה שגיאה במחיקת הקטגוריה.","list":"הצג קטגוריות","no_description":"אנא הוסיפו תיאור לקטגוריה זו.","change_in_category_topic":"ערוך תיאור","already_used":"הצבע הזה בשימוש על ידי קטגוריה אחרת","security":"אבטחה","images":"תמונות","auto_close_label":"נעל נושאים אוטומטית אחרי:","auto_close_units":"שעות","email_in":"כתובת דואר נכנס מותאמת אישית:","email_in_allow_strangers":"קבלת דוא\"ל ממשתמשים אנונימיים ללא חשבונות במערכת הפורומים","email_in_disabled":"האפשרות פרסום נושאים חדשים דרך הדוא\"ל נוטרלה דרך הגדרות האתר. לאפשר פרסום באמצעות  משלוח דוא\"ל.","email_in_disabled_click":"אפשרו את את ההגדרה \"דוא\"ל נכנס\"","allow_badges_label":"הרשו לתגים (badges) להיות מוענקים בקטגוריה זו","edit_permissions":"ערוך הרשאות","add_permission":"הוסף הרשאה","this_year":"השנה","position":"מיקום","default_position":"מיקום ברירת מחדל","position_disabled":"קטגוריות יוצגו על פס סדר הפעילות. כדי לשלוט בסדר הקטגורייות ברשימה,","position_disabled_click":"אפשרו את ההגדרה \"סדר קטגוריות קבוע\".","parent":"קטגורית אם","notifications":{"watching":{"title":"צופה","description":"את/ה תצפו באופן אוטומטי בכל הנושאים שיפורסמו בקטגריות אלו. תקבלו התראה על נושאים חדשים וסך ההודעות החדשות ואלו שלא נקראו יופיע לצד רשימת הנושאים."},"tracking":{"title":"במעקב","description":"תעקבו באופן אוטומטי אחרי כל הודעה חדשה בקטגוריות אלו. סך הפרסומים החדשים ואלו שלא נקראו יופיע לצד שם הנושא."},"regular":{"title":"רגיל","description":"תקבל הודעה רק אם מישהו/מישהי יזכירו את @השם-שלך או ישיבו להודעתך"},"muted":{"title":"מושתק","description":"לא תקבל התרעות בנוגע לנושאים חדשים בקטגוריות האלה, והם לא יופיעו בלשונית ה\"לא נקראו\" שלך."}}},"flagging":{"title":"מדוע את/ה מסמנים את הנושא באופן פרטי?","action":"סימון פרסום","take_action":"בצע פעולה","notify_action":"הודעה פרטית","delete_spammer":"מחק ספאמר","delete_confirm":"אתה עומד למחוק \u003cb\u003e%{posts}\u003c/b\u003e הודעות ו-\u003cb\u003e%{topics}\u003c/b\u003e נושאים של המשתמש הזה, להסיר את החשבון שלהם, לחסור הרשמה מכתובת ה-IP שלהם \u003cb\u003e%{ip_address}\u003c/b\u003e, ולהוסיף את כתובת הדואר האלקטרוני \u003cb\u003e%{email}\u003c/b\u003e לרשימה שחורה. אתה בטוח שזה באמת ספאמר?","yes_delete_spammer":"כן, מחק ספאמר","submit_tooltip":"שידור הסימון  כ \"פרטי\"","take_action_tooltip":"הגעה באופן מיידי למספר הסימונים האפשרי, במקום להמתין לסימונים נוספים מן הקהילה","cant":"סליחה, לא ניתן לסמן הודעה זו כרגע.","custom_placeholder_notify_user":"מדוע ההודעה הזו דורשת ממך לדבר עם משתמש זה ישירות ובפרטיות? היה ספציפי, בונה, ותמיד אדיב.","custom_placeholder_notify_moderators":"מדוע הודעה זו דורשת תשומת לב של מנהל? ספר לנו באופן ספציפי מה מטריד לגבי זה וצרף קישורים רלוונטיים כשניתן.","custom_message":{"at_least":"הזן לפחות {{n}} תווים","more":"{{n}} נשארו...","left":"{{n}} נותרו"}},"flagging_topic":{"title":"מדוע את/ה מסמנים את נושא זה באופן פרטי?","action":"סימון נושא","notify_action":"הודעה פרטית"},"topic_map":{"title":"סיכום נושא","links_shown":"הצג את כל הקישורים {{totalLinks}}...","clicks":{"one":"לחיצה אחת","other":"%{count} לחיצות"}},"topic_statuses":{"locked":{"help":"הנושא הזה נעול, הוא לא מקבל יותר תגובות חדשות"},"unpinned":{"title":"הורד מנעיצה","help":"הנושא הזה אינו נעוץ. הוא יוצג לפי סדר ברירת המחדל"},"pinned_globally":{"title":"נעוץ גלובאלית","help":"הנושא הזה נעוץ גלובאלית; הוא יוצג בראש כל הרשימות"},"pinned":{"title":"נעוץ","help":"הנושא הזה נעוץ; הוא יוצג בראש הקטגוריה שלו"},"archived":{"help":"הנושא הזה אוכסן בארכיון; הוא הוקפא ולא ניתן לשנותו"},"invisible":{"help":"הנושא הזה בלתי נראה; הוא לא יוצג יותר ברשימת הנושאים, וניתן לגשת אליו רק עם קישור ישיר"}},"posts":"הודעות","posts_lowercase":"פרסומים","posts_long":"יש {{number}} הודעות בנושא הזה","original_post":"הודעה מקורית","views":"צפיות","views_lowercase":"תצוגות","replies":"תגובות","views_long":"הנושא הזה נצפה {{number}} פעמים","activity":"פעילות","likes":"לייקים","likes_lowercase":"לייקים","likes_long":"יש {{number}} לייקים לנושא הזה","users":"משתמשים","users_lowercase":"משתמשים","category_title":"קטגוריה","history":"היסטוריה","changed_by":"מאת {{author}}","categories_list":"רשימת קטגוריות","filters":{"latest":{"title":"מדוברים","help":"נושאים עם תגובות לאחרונה"},"hot":{"title":"חם","help":"מבחר הנושאים החמים ביותר"},"starred":{"title":"כוכב","help":"נושאים שסימנת בכוכב"},"read":{"title":"נקרא","help":"נושאים שקראת, לפי סדר קריאתם"},"categories":{"title":"קטגוריות","title_in":"קטגוריה - {{categoryName}}","help":"כל הנושאים תחת הקטגוריה הזו"},"unread":{"title":{"zero":"לא נקרא","one":"לא נקרא (1)","other":"לא נקראו ({{count}})"},"help":"נושאים שאתם כרגע צופים או עוקבים אחריהם עם פרסומים שלא נקראו","lower_title_with_count":{"one":"1 שלא נקרא","other":"{{count}} שלא נקראו"}},"new":{"lower_title_with_count":{"one":"1 חדש","other":"{{count}} חדשים"},"lower_title":"חדש","title":{"zero":"חדש","one":"חדש (1)","other":"חדשים ({{count}})"},"help":"פרסומים נוצרו בימים האחרונים"},"posted":{"title":"ההודעות שלי","help":"נושאים בהם פרסמת"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"נושאים מדוברים בקטגוריה {{categoryName}}"},"top":{"title":"מובילים","yearly":{"title":"מובילים שנתי"},"monthly":{"title":"מובילים חודשי"},"weekly":{"title":"המיטב השבועי"},"daily":{"title":"המיטב היומי"},"this_year":"השנה","this_month":"החודש","this_week":"השבוע","today":"היום","other_periods":"ראו עוד נושאים מובילים."}},"permission_types":{"full":"צרו / תגובה/ צפייה","create_post":"תגובה / צפייה","readonly":"צפה"},"type_to_filter":"הקלד לסינון...","admin":{"title":"ניהול Discourse","moderator":"מנהל","dashboard":{"title":"לוח בקרה","last_updated":"עדכון אחרון של לוח הבקרה:","version":"גירסה","up_to_date":"אתה מעודכן!","critical_available":"עדכון קריטי מוכן להתקנה.","updates_available":"עדכונים מוכנים.","please_upgrade":"בבקשה שדרג!","no_check_performed":"לא בוצעה בדיקה לעדכונים. וודא ש-sidekiq פועל.","stale_data":"לא בוצעה בדיקת עדכונים לאחרונה. וודא ש-sidekiq פועל.","version_check_pending":"נראה שעדכנת לאחרונה. פנטסטי!","installed_version":"הותקן","latest_version":"אחרונה","problems_found":"נמצאו מספר בעיות עם התקנת Discourse שלך:","last_checked":"נבדק לאחרונה","refresh_problems":"רענן","no_problems":"לא נמצאו בעיות.","moderators":"מנהלים:","admins":"מנהלים ראשיים:","blocked":"חסומים:","suspended":"מושעים:","private_messages_short":"ה\"פ","private_messages_title":"הודעות פרטיות","reports":{"today":"היום","yesterday":"אתמול","last_7_days":"בשבעת הימים האחרונים","last_30_days":"ב-30 הימים האחרונים","all_time":"כל הזמן","7_days_ago":"לפני שבעה ימים","30_days_ago":"לפני 30 ימים","all":"הכל","view_table":"הצג כטבלה","view_chart":"הצג כתרשים עמודות"}},"commits":{"latest_changes":"שינויים אחרונים: בבקשה עדכן תכופות!","by":"על ידי"},"flags":{"title":"סימונים","old":"ישן","active":"פעיל","agree":"הסכמה","agree_title":"אישור סימון זה כתקין ונכון","agree_flag_modal_title":"הסכמה ו...","agree_flag_hide_post":"קבחה (הסתרת פרסום + שליחת מסר פרטי)","agree_flag_hide_post_title":"הסתירו פרסום זה ושלחו למשתמ/ת מסר פרטי אוטומטי עם בקשה לערוך אותו.","agree_flag":"הסכמה עם הסימון","agree_flag_title":"הסכמה עם הסימון ושמירת הפרסום ללא שינוי","defer_flag":"דחייה","defer_flag_title":"הסרת סימון זה; הוא אינו דורש פעולה כעת.","delete":"מחיקה","delete_title":"מחיקת הפרסום המסומן כאן.","delete_post_defer_flag":"מחיקת הפרסום ודחיית הסימון","delete_post_defer_flag_title":"מחיקת הפרסום; אם זהו הפרסום הראשון, מחיקת הנושא","delete_post_agree_flag":"מחיקת הפרסום והסכמה עם הסימון","delete_post_agree_flag_title":"מחיקת פרסום; אם זהו הפרסום הראשון, מחיקת הנושא","delete_flag_modal_title":"מחיקה ו...","delete_spammer":"מחיקת ספאמר","delete_spammer_title":"הסרת המשתמש/ת וכל הפרסומים והנושאים של משתמש/ת אלו.","disagree_flag_unhide_post":"אי-קבלה (הצגה מחדש של הפרסום)","disagree_flag_unhide_post_title":"הסרה של כל הסימונים מהפרסום הזה והחזרתו למצב תצוגה","disagree_flag":"אי קבלה","disagree_flag_title":"התעלמות מהסימון היות שאינו תקין או אינו נכון","clear_topic_flags":"סיום","clear_topic_flags_title":"הנושא נבדק והבעיה נפתרה. לחצו על סיום כדי להסיר את הסימונים.","dispositions":{"agreed":"התקבל","disagreed":"לא התקבל","deferred":"נדחה"},"flagged_by":"דוגלל על ידי","resolved_by":"נפתר על ידי","took_action":"ננקטה פעוללה","system":"מערכת","error":"משהו השתבש","reply_message":"תגובה","no_results":"אין סימונים.","topic_flagged":"\u003cstrong\u003eהנושא\u003c/strong\u003e הזה דוגלל.","visit_topic":"בקרו בנושא כדי לנקוט פעולה","summary":{"action_type_3":{"one":"אוף-טופיק","other":"אוף-טופיק x{{count}}"},"action_type_4":{"one":"לא ראוי","other":"לא ראוי x{{count}}"},"action_type_6":{"one":"מותאם אישית","other":"מותאם אישית x{{count}}"},"action_type_7":{"one":"מותאם אישית","other":"מותאם אישית x{{count}}"},"action_type_8":{"one":"ספאם","other":"ספאם x{{count}}"}}},"groups":{"primary":"קבוצה ראשית","no_primary":"(אין קבוצה ראשית)","title":"קבוצות","edit":"ערוך קבוצות","refresh":"רענן","new":"חדש","selector_placeholder":"הוסף משתמשים","name_placeholder":"שם הקבוצה, ללא רווחים, בזהה לחוקי שם המשתמש","about":"ערוך את חברות הקבוצה שלך והשמות כאן","group_members":"חברי הקבוצה","delete":"מחק","delete_confirm":"למחוק קבוצה זו?","delete_failed":"לא ניתן למחוק קבוצה זו. אם זו קבוצה אוטומטית, היא בלתי ניתנת למחיקה."},"api":{"generate_master":"ייצר מפתח מאסטר ל-API","none":"אין מפתחות API פעילים כרגע.","user":"משתמש","title":"API","key":"מפתח API","generate":"ייצר","regenerate":"ייצר מחדש","revoke":"שלול","confirm_regen":"אתה בטוח שברצונך להחליף את מפתח ה-API באחד חדש?","confirm_revoke":"אתה בטוח שברצונך לשלול את המפתח הזה?","info_html":"מפתח הAPI שלך יאפשר לך ליצור ולעדכן נושאים בעזרת קריאות JSON.","all_users":"כל המשתמשים"},"backups":{"title":"גיבויים","menu":{"backups":"גיבויים","logs":"לוגים"},"none":"אין גיבויים זמינים.","read_only":{"enable":{"title":"אפשר מצב קריאה בלבד","text":"אפשר מצב קריאה בלבד","confirm":"אתה בטוח שברצונך לאפשר את מצב קריאה בלבד??"},"disable":{"title":"בטל מצב קריאה בלבד","text":"בטל מצב קריאה בלבד"}},"logs":{"none":"עדיין אין לוגים..."},"columns":{"filename":"שם קובץ","size":"גודל"},"upload":{"text":"העלאה","uploading":"מעלה","success":"'{{filename}}' הועלה בהצלחה.","error":"הייתה שגיאה במהלך העלאת '{{filename}}': {{message}}"},"operations":{"is_running":"פעולה רצה כרגע...","failed":"ה{{operation}} נכשלה. אנא בדוק את הלוגים.","cancel":{"text":"ביטול","title":"בטל את הפעולה הנוכחית","confirm":"אתה בטוח שברצונך לבטל את הפעולה הנוכחית?"},"backup":{"text":"גיבוי","title":"צור גיבוי"},"download":{"text":"הורד","title":"הורד את הגיבוי"},"destroy":{"text":"מחק","title":"הסר את הגיבוי","confirm":"אתה בטוח שברצונך להשמיד את הגיבוי הזה?"},"restore":{"is_disabled":"שחזור אינו מאופשר לפי הגדרות האתר.","text":"שחזר","title":"שחזר את הגיבוי","confirm":"אתה בטוח שברצונך לשחזר את הגיבוי הזה?"},"rollback":{"text":"חזור לאחור","title":"הזחר את מסד הנתונים למצב עבודה קודם","confirm":"אתה בטוח שברצונך להחזיר את מסד הנתונים למצב עבודה קודם?"}}},"customize":{"title":"התאם אישית","long_title":"התאמה של האתר","header":"כותרת","css":"Stylesheet","mobile_header":"כותרת סלולרית","mobile_css":"Stylesheet סלולרי","override_default":"אל תכלול את ה-Stylesheet הסטנדרטי","enabled":"מאופשר?","preview":"תצוגה מקדימה","undo_preview":"הסרת התצוגה המקדימה","rescue_preview":"ברירת מחדל סגנונית","explain_preview":"הצג את האתר על פי גיליון הסגנונות המותאם הזה","explain_undo_preview":"חזרה לגיליון הסגנונות המותאם המופעל כרגע","explain_rescue_preview":"צפיה באתר עם גליון הסגנונות העיצובי של ברירת המחדל","save":"שמור","new":"חדש","new_style":"סגנון חדש","delete":"מחק","delete_confirm":"מחק את ההתאמה הזו?","about":"שינוי סגנונות CSS וכותרות HTML באתר. הוספת התאמות כדי להתחיל לערוך.","color":"צבע","opacity":"טשטוש","copy":"העתק","css_html":{"title":"CSS/HTML","long_title":"התאמת CSS ו-HTML"},"colors":{"title":"צבעים","long_title":"סכמת צבעים","about":"סכמת צבעים מאפשרת לך לשנות את הצבעים שבשימוש האתר ללא כתיבת קוד CSS. בחרו או הוסיפו סכימה אחת כדי להתחיל.","new_name":"סכמת צבעים חדשה","copy_name_prefix":"העתק של","delete_confirm":"מחק את סכמת הצבעים הזאת?","undo":"ביטול (Unfo)","undo_title":"ביטול השינויים לצבע זה מאז הפעם שעברה שהוא נשמר.","revert":"לחזור","revert_title":"אתחול צבע זה לפי סכימת ברירת המחדל של Discourse.","primary":{"name":"ראשי","description":"רוב הטקסט, הייקונים והמסגרות."},"secondary":{"name":"משני","description":"צבע הרקע העיקי, וצבע הטקסט של חלק מהכפתורים."},"tertiary":{"name":"שלישוני","description":"קישורים, כפתורים, עדכונים וצבע מבטא."},"quaternary":{"name":"רבעוני","description":"קישורי ניווט."},"header_background":{"name":"רקע כותרת","description":"צבע הרקע של כותרת האתר."},"header_primary":{"name":"כותר עיקרי","description":"טקסט ואייקונים בכותרת האתר."},"highlight":{"name":"הדגשה","description":"צבע הרקע של אלמנטים מודגשים בעמוד, כמו הודעות ונושאים."},"danger":{"name":"זהירות","description":"צבע הדגשה של פעולות כמו מחיקת הודעות ונושאים."},"success":{"name":"הצלחה","description":"משמש כדי לסמן פעולה מוצלחת."},"love":{"name":"חבב","description":"צבע הרקע של הכפתור \"חבב\""}}},"email":{"title":"דואר אלקטרוני","settings":"הגדרות","all":"הכל","sending_test":"שולח דואר אלקטרוני לבדיקה...","test_error":"הייתה בעיה בשליחת הדואר האלקטרוני. בבקשה בדוק את ההגדרות שלך ונסה שנית.","sent":"נשלח","skipped":"דולג","sent_at":"נשלח ב","time":"זמן","user":"משתמש","email_type":"סוג דואר אלקטרוני","to_address":"לכתובת","test_email_address":"כתובת דואר אלקטרוני לבדיקה","send_test":"שליחת מייל בדיקה","sent_test":"נשלח!","delivery_method":"שיטת העברה","preview_digest":"תצוגה מקדימה של סיכום","preview_digest_desc":"זה כלי לתצוגה מקדימה של תוכן של הודעת הסיכום הנשלחות בדואר אלקטרוני מהפורום.","refresh":"רענן","format":"פורמט","html":"html","text":"טקסט","last_seen_user":"משתמש שנראה לאחרונה:","reply_key":"מפתח תגובה","skipped_reason":"דלג על סיבה","logs":{"none":"לא נמצאו לוגים.","filters":{"title":"סינון","user_placeholder":"username","address_placeholder":"name@example.com","type_placeholder":"digest, signup...","skipped_reason_placeholder":"סיבה"}}},"logs":{"title":"לוגים","action":"פעולה","created_at":"נוצר","last_match_at":"הותאם לאחרונה","match_count":"תואם","ip_address":"IP","delete":"מחק","edit":"ערוך","save":"שמור","screened_actions":{"block":"חסום","do_nothing":"עשה כלום"},"staff_actions":{"title":"פעולות צוות","instructions":"לחץ על שמות משתמש ופעולות כדי לסנן את הרשימה. לחץ על אוואטרים כדי ללכת לעמוד המשתמש.","clear_filters":"הראה הכל","staff_user":"משתמש חבר צוות","target_user":"משתמש מטרה","subject":"נושא","when":"מתי","context":"הקשר","details":"פרטים","previous_value":"הקודם","new_value":"חדש","diff":"הפרש","show":"הראה","modal_title":"פרטים","no_previous":"אין ערך קודם.","deleted":"אין ערך חדש. הרשומה נמחקה.","actions":{"delete_user":"מחק משתמש","change_trust_level":"שנה רמת אמון","change_site_setting":"שנה הגדרות אתר","change_site_customization":"שנה התאמת אתר","delete_site_customization":"מחק התאמת אתר","suspend_user":"השעה משתמש","unsuspend_user":"בטל השהיית משתמש","grant_badge":"הענק תג","revoke_badge":"שלול תג"}},"screened_emails":{"title":"הודעות דואר מסוננות","description":"כשמישהו מנסה ליצור חשבון חדש, כתובות הדואר האלקטרוני הבאות ייבדקו וההרשמה תחסם או שיבוצו פעולות אחרות.","email":"כתובת דואר אלקטרוני","actions":{"allow":"לאפשר"}},"screened_urls":{"title":"כתובות מסוננות","description":"הכתובות הרשומות כאן היו בשימוש בהודעות  מאת משתמשים שזוהו כספאמרים.","url":"כתובת","domain":"שם מתחם"},"screened_ips":{"title":"כתובות IP מסוננות","description":"כתובות IP שנצפות כרגע. השתמש בכפתור \"אפשר\" בשביל לבטל חסימת כתובת","delete_confirm":"אתה בטוח שברצונך להסיר את הכלל עבור הכתובת %{ip_address}?","actions":{"block":"חסום","do_nothing":"אפשר"},"form":{"label":"חדש:","ip_address":"כתובת IP","add":"הוסף"}}},"users":{"title":"משתמשים","create":"הוסף מנהל","last_emailed":"נשלח בדואר אלקטרוני לאחרונה","not_found":"סליחה, שם המשתמש הזה אינו קיים במערכת שלנו.","active":"פעיל","nav":{"new":"חדש","active":"פעיל","pending":"ממתין","admins":"מנהלים ראשיים","moderators":"מנהלים","suspended":"מושעים","blocked":"חסום"},"approved":"מאושר?","approved_selected":{"one":"אשר משתמש","other":"אשר משתמשים ({{count}})"},"reject_selected":{"one":"דחה משתמש","other":"דחה משתמשים ({{count}})"},"titles":{"active":"הפעל משתמשים","new":"משתמשים חדשים","pending":"משתמשים שממתינים לבדיקה","newuser":"משתמשים ברמת אמון 0 (משתמש חדש)","basic":"משתמשים ברמת אמון 1 (משתמש בסיסי)","regular":"משתמשים ברמת אמון 2 (משתמש רגיל)","elder":"משתמשים ברמת אמון 4 (זקן שבט)","admins":"מנהלים ראשיים","moderators":"מנהלים","blocked":"משתמשים חסומים","suspended":"משתמשים מושעים"},"reject_successful":{"one":"משתמש אחד נדחה בהצלחה.","other":"%{count} משתמשים נדחו בהצלחה."},"reject_failures":{"one":"דחיית משתמש אחד נדחתה.","other":"דחיית %{count} משתמשים נכשלה."}},"user":{"suspend_failed":"משהו נכשל בהשעיית המשתמש הזה {{error}}","unsuspend_failed":"משהו נכשל בביטול השהיית המשתמש הזה {{error}}","suspend_duration":"למשך כמה זמן יהיה המשתמש מושעה?","suspend_duration_units":"(ימים)","suspend_reason_label":"מדוע אתה משעה? הטקסט הזה \u003cb\u003eיהיה נראה לכולם\u003c/b\u003e בעמוד המשתמש הזה, ויוצג למשתמש כשינסה להתחבר. נסה לשמור עליו קצר.","suspend_reason":"סיבה","suspended_by":"הושעה על ידי","delete_all_posts":"מחק את כל ההודעות","delete_all_posts_confirm":"אתה עומד למחוק %{posts} הודעות ו-%{topics} נושאים. אתה בטוח?","suspend":"השעה","unsuspend":"בטל השעייה","suspended":"מושעה?","moderator":"מנהל?","admin":"מנהל ראשי?","blocked":"חסום?","show_admin_profile":"מנהל ראשי","edit_title":"ערוך כותרת","save_title":"שמור כותרת","refresh_browsers":"הכרח רענון דפדפן","show_public_profile":"הצג פרופיל פומבי","impersonate":"התחזה","ip_lookup":"חיפוש IP","log_out":"התנתקות","logged_out":"המשתמש/ת התנתקו בכל המכשירים","revoke_admin":"שלול ניהול ראשי","grant_admin":"הענק ניהול ראשי","revoke_moderation":"שלול ניהול","grant_moderation":"הענק ניהול","unblock":"בטל חסימה","block":"חסום","reputation":"מוניטין","permissions":"הרשאות","activity":"פעילות","private_topics_count":"נושאים פרטיים","posts_read_count":"הודעות שנקראו","post_count":"הודעות שנוצרו","topics_entered":"נושאים שנצפו","flags_given_count":"דגלים שניתנו","flags_received_count":"סימונים שהתקבלו","approve":"אשר","approved_by":"אושר על ידי","approve_success":"משתמש אושר ונשלחה לו הודעות דואר אלקטרוני עם הוראות הפעלה","approve_bulk_success":"הצלחה! כל המשתמשים שנבחרו אושרו ויודעו על כך.","time_read":"זמן קריאה","delete":"מחק משתמש","delete_forbidden_because_staff":"לא ניתן למחוק מנהלים ראשיים ומנהלים.","delete_forbidden":{"one":"לא ניתן למחוק משתמשים אם יש להם הודעות. מחק את כל ההודעות לפני ניסיון מחיקה של משתמש. (הודעות ישנות יותר מ-%{count} ימים לא ניתן למחוק.)","other":"לא ניתן למחוק משתמשים אם יש להם הודעות. מחק את כל ההודעות לפני ניסיון מחיקה של משתמש. (הודעות ישנות יותר מ-%{count} ימים לא ניתן למחוק.)"},"cant_delete_all_posts":{"one":"לא יכול למחוק את כל ההודעות. חלק מההודעות ישנות יותר מ-%{count} ימים. (הגדרת delete_user_max_post_age.)","other":"לא יכול למחוק את כל ההודעות. חלק מההודעות ישנות יותר מ-%{count} ימים. (הגדרת delete_user_max_post_age.)"},"cant_delete_all_too_many_posts":{"one":"לא ניתן למחוק את כל ההודעות מפני שלמשתמש/ת יותר מהודעה אחת. (delete_all_posts_max)","other":"לא ניתן למחוק את כל ההודעות בגלל שלמשתמש/ת יותר מ-{count}% הודעות. (delete_all_posts_max)"},"deleted":"המשתמש נמחק.","delete_failed":"הייתה שגיאה במחיקת המשתמש. יש לוודא שכל ההודעות נמחקו לפני ניסיון למחוק את המשתמש.","send_activation_email":"שלח הודעת הפעלת חשבון","activation_email_sent":"נשלחה הודעת הפעלת חשבון","send_activation_email_failed":"הייתה בעיה בשליחת הודעת האישור. %{error}","activate":"הפעלת חשבון","activate_failed":"הייתה בעיה בהפעלת המשתמש.","deactivate_account":"נטרל חשבון","deactivate_failed":"הייתה בעיה בנטרול חשבון המשתמש.","unblock_failed":"הייתה בעיה בביטול חסימת המשתמש.","block_failed":"הייתה בעיה בחסימת המשתמש.","deactivate_explanation":"חשבון משתמש מנוטרל נדרש לוודא דואר אלקטרוני מחדש.","suspended_explanation":"משתמש מושעה לא יכול להתחבר.","block_explanation":"משתמש חסום לא יכול לפרסם הודעות או נושאים.","trust_level_change_failed":"הייתה בעיה בשינוי רמת האמון של המשתמש.","suspend_modal_title":"השעה משתמש","trust_level_2_users":"משתמשי רמת אמון 2","trust_level_3_requirements":"דרישות רמת אמון 3","tl3_requirements":{"title":"דרישות עבור רמת אמון 3","table_title":"במאה הימים האחרונים:","value_heading":"ערך","requirement_heading":"דרישה","visits":"ביקורים","days":"ימים","topics_replied_to":"נושאים להם הגיבו","topics_viewed":"נושאים שנצפו","topics_viewed_all_time":"נושאים שנצפו (בכל זמן)","posts_read":"פרסומים שנקראו","posts_read_all_time":"פרסומים שנקראו (בכל זמן)","flagged_posts":"הודעות מדוגללות","flagged_by_users":"משתמשים שסימנו","qualifies":"דרישות עבור רמת אמון 3","will_be_promoted":"יקודם בתוך 24 שעות.","does_not_qualify":"אין עומד בדרישות עבור רמת אמון 3."}},"site_content":{"none":"בחר סוג תוכן לפני תחילת העריכה.","title":"תוכן","edit":"ערוך תוכן אתר"},"site_settings":{"show_overriden":"הצג רק הגדרות ששונו","title":"הגדרות","reset":"אתחול","none":"ללא","no_results":"לא נמצאו תוצאות.","clear_filter":"נקה","categories":{"all_results":"הכל","required":"נדרש","basic":"התקנה בסיסית","users":"משתמשים","posting":"פרסומים","email":"דואר אלקטרוני","files":"קבצים","trust":"רמת אמון","security":"אבטחה","onebox":"Onebox","seo":"SEO","spam":"ספאם","rate_limits":"מגבלות קצב","developer":"מפתח","embedding":"הטמעה","legal":"משפטי","uncategorized":"אחר","backups":"גיבויים","login":"התחברות"}},"badges":{"title":"תגים","new_badge":"תג חדש","new":"חדש","name":"שם","badge":"תג","display_name":"שם תצוגה","description":"תיאור","badge_type":"סוג תג","badge_grouping":"קבוצה","badge_groupings":{"modal_title":"תג קבוצות"},"granted_by":"הוענק ע\"י","granted_at":"הוענק ב","save":"שמור","delete":"מחק","delete_confirm":"אתה בטוח שברצונך למחוק את התג הזה?","revoke":"שלול","revoke_confirm":"אתה בטוח שברצונך לשלול את התג הזה?","edit_badges":"ערוך תגים","grant_badge":"הענק תג","granted_badges":"תגים שהוענקו","grant":"הענק","no_user_badges":"ל%{name} לא הוענקו תגים.","no_badges":"אין תגים שניתן להעניק.","allow_title":"אפשר לתג להיות בשימוש ככותרת.","multiple_grant":"יכול/ה להינתן מספר פעמים","listable":"הצגת תגים בעמוד התגים הפומבי","enabled":"אפשר תג","icon":"סמליל","query":"שאילתת תגים (SQL)","target_posts":"פרסומי מטרות שאילתה","auto_revoke":"הפעלת שאילתת ביטול יומית","show_posts":"הצגת הפוסט על הענקת התגים בעמוד התגים","trigger":"הפעלה","trigger_type":{"none":"רענון יומי","post_action":"כשמשתמש משנה פוסט","post_revision":"כשמשתש משנה או יוצר פוסט","trust_level_change":"כשמשתמש משנה רמת אמון","user_change":"כשמשתמש נערך או נוצר"}}},"lightbox":{"download":"הורד"},"keyboard_shortcuts_help":{"title":"קיצורי מקלדת","jump_to":{"title":"קפוץ ל"},"navigation":{"title":"ניווט","jump":"\u003cb\u003e#\u003c/b\u003e מעבר לפרסום מספר","back":"\u003cb\u003eu\u003c/b\u003e חזרה","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e הזז בחירה מעלה/מטה","open":"\u003cb\u003eo\u003c/b\u003e או \u003cb\u003eEnter\u003c/b\u003e פתח נושא נבחר"},"application":{"title":"יישום","create":"\u003cb\u003ec\u003c/b\u003e צור נושא חדש","notifications":"\u003cb\u003en\u003c/b\u003e פתח התרעות","search":"\u003cb\u003e/\u003c/b\u003e חיפוש","help":"\u003cb\u003e?\u003c/b\u003e פתח עזרת קיצורי מקשים"},"actions":{"title":"פעולות","star":"\u003cb\u003ef\u003c/b\u003e סמן נושא בכוכב","share_topic":"\u003cb\u003e shift s\u003c/b\u003e שיתוף נושא","share_post":"\u003cb\u003es\u003c/b\u003e שיתוף הודעה","reply_topic":"\u003cb\u003e shift r\u003c/b\u003e להגיב לנושא","reply_post":"\u003cb\u003er\u003c/b\u003e להגיב להודעה","quote_post":"\u003cb\u003e q \u003c/b\u003e ציטוט פוסט","like":"\u003cb\u003el\u003c/b\u003e תן לייק להודעה","flag":"\u003cb\u003e!\u003c/b\u003e סימון הודעה","bookmark":"\u003cb\u003eb\u003c/b\u003e הוסף הודעה למועדפים","edit":"\u003cb\u003ee\u003c/b\u003e ערוך הודעה","delete":"\u003cb\u003ed\u003c/b\u003e מחק הודעה"}},"badges":{"title":"תגים","allow_title":"אישור תגים ככותרת?","multiple_grant":"הוענק מספר פעמים?","badge_count":{"one":"תג אחד","other":"%{count} תגים"},"more_badges":{"one":"עוד +1","other":"עוד +%{count}"},"granted":{"one":"1 הוענק","other":"%{count} הוענקו"},"select_badge_for_title":"בחר תג שיופיע בכותרת הפרופיל שלך","no_title":"\u003cno title\u003e","badge_grouping":{"getting_started":{"name":"מתחילים"},"community":{"name":"קהילה"},"trust_level":{"name":"רמת אמון"},"other":{"name":"אחר"},"posting":{"name":"פרסום"}},"badge":{"editor":{"name":"עורך","description":"עריכה ראשונה של פוסט"},"basic_user":{"name":"בסיסי","description":"\u003ca href=\"https://meta.d הפעולות הקהילתיות הבסיסיותiscourse.org/t/what-do-user-trust-levels-do/4924/4\"\u003eמאושרות\u003c/a\u003e כל"},"regular_user":{"name":"קבוע","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/5\"\u003eמאושרות\u003c/a\u003e הזמנות"},"leader":{"name":"מוביל/ה","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/6\"\u003eמאושר\u003c/a\u003e שינוי קטגוריה, שינוי שם, קישורים והעברה"},"elder":{"name":"זקן/זקנת השבט","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/7\"\u003eמאושרת\u003c/a\u003e global עריכה, נעיצה, סגירה, תיוק, פיצול ומיזוג"},"welcome":{"name":"ברוכים הבאים","description":"קיבל לייק"},"autobiographer":{"name":"אוטוביוגרפר/ית?","description":"פרופיל \u003ca href=\"/my/preferences\"\u003eמידע\u003c/a\u003e משתמש"},"nice_post":{"name":"פרסום נחמד","description":"קיבל/ה 10 לייקים על הפוסט. תג זה ניתן להעניק שוב ושוב ללא הגבלה"},"good_post":{"name":"פרסום מוצלח","description":"קיבל/ה 25 לייקים על הפוסט. תג זה ניתן להעניק שוב ושוב ללא הגבלה"},"great_post":{"name":"פרסום מצויין","description":"קבלת 50 לייקים על פרסום. תג זה יכול להיות מוענק מספר פעמים"},"first_like":{"name":"לייק ראשון","description":"חיבב/ה פרסום"},"first_flag":{"name":"סימון ראשון","description":"סימן/סימנה פרסום"},"first_share":{"name":"שיתוף ראשון","description":"שיתף/שיתפה פרסום"},"first_link":{"name":"קישור (link) ראשון","description":"הוסיף/הוסיפה קישור פנימי לנושא אחר"},"first_quote":{"name":"ציטוט ראשון","description":"ציטוט משתמש"},"read_guidelines":{"name":"קריאת כללים מנחים","description":"קראו את \u003ca href=\"/guidelines\"\u003e הכללים המנחים של הקהילה \u003c/a\u003e"},"reader":{"name":"מקראה","description":"קראו כל פרסום בנושא עם יותר מ-100 פרסומים"}}}}}};
I18n.locale = 'he';
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
// locale : Hebrew (he)
// author : Tomer Cohen : https://github.com/tomer
// author : Moshe Simantov : https://github.com/DevelopmentIL
// author : Tal Ater : https://github.com/TalAter

(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define(['moment'], factory); // AMD
    } else if (typeof exports === 'object') {
        module.exports = factory(require('../moment')); // Node
    } else {
        factory(window.moment); // Browser global
    }
}(function (moment) {
    return moment.defineLocale('he', {
        months : "ינואר_פברואר_מרץ_אפריל_מאי_יוני_יולי_אוגוסט_ספטמבר_אוקטובר_נובמבר_דצמבר".split("_"),
        monthsShort : "ינו׳_פבר׳_מרץ_אפר׳_מאי_יוני_יולי_אוג׳_ספט׳_אוק׳_נוב׳_דצמ׳".split("_"),
        weekdays : "ראשון_שני_שלישי_רביעי_חמישי_שישי_שבת".split("_"),
        weekdaysShort : "א׳_ב׳_ג׳_ד׳_ה׳_ו׳_ש׳".split("_"),
        weekdaysMin : "א_ב_ג_ד_ה_ו_ש".split("_"),
        longDateFormat : {
            LT : "HH:mm",
            L : "DD/MM/YYYY",
            LL : "D [ב]MMMM YYYY",
            LLL : "D [ב]MMMM YYYY LT",
            LLLL : "dddd, D [ב]MMMM YYYY LT",
            l : "D/M/YYYY",
            ll : "D MMM YYYY",
            lll : "D MMM YYYY LT",
            llll : "ddd, D MMM YYYY LT"
        },
        calendar : {
            sameDay : '[היום ב־]LT',
            nextDay : '[מחר ב־]LT',
            nextWeek : 'dddd [בשעה] LT',
            lastDay : '[אתמול ב־]LT',
            lastWeek : '[ביום] dddd [האחרון בשעה] LT',
            sameElse : 'L'
        },
        relativeTime : {
            future : "בעוד %s",
            past : "לפני %s",
            s : "מספר שניות",
            m : "דקה",
            mm : "%d דקות",
            h : "שעה",
            hh : function (number) {
                if (number === 2) {
                    return "שעתיים";
                }
                return number + " שעות";
            },
            d : "יום",
            dd : function (number) {
                if (number === 2) {
                    return "יומיים";
                }
                return number + " ימים";
            },
            M : "חודש",
            MM : function (number) {
                if (number === 2) {
                    return "חודשיים";
                }
                return number + " חודשים";
            },
            y : "שנה",
            yy : function (number) {
                if (number === 2) {
                    return "שנתיים";
                }
                return number + " שנים";
            }
        }
    });
}));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('MMMM D, YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
