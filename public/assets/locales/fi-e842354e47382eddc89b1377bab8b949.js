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
MessageFormat.locale.fi = function ( n ) {
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
r += "Sinulla on ";
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
r += "<a href='/unread'>1 lukematon</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "<a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " lukematonta</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "ja ";
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
r += " <a href='/new'>1 uusi</a> ketju";
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
})() + " uutta</a> kejua";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " jäljellä, voit myös ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "selata muita ketjuja alueella ";
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
r += "Tässä ketjussa on ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 viesti, jolla on";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " viestiä, joilla on";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "suuri määrä tykkäyksiä suhteessa viestien määrään";
return r;
},
"med" : function(d){
var r = "";
r += "erittäin suuri määrä tykkäyksiä suhteessa viestien määrään";
return r;
},
"high" : function(d){
var r = "";
r += "äärimmäisen suuri määrä tykkäyksiä suhteessa viestien määrään";
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
}});I18n.translations = {"fi":{"js":{"number":{"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Tavu","other":"Tavua"},"gb":"Gt","kb":"Kt","mb":"Mt","tb":"Tt"}}}},"dates":{"time":"H:mm","long_no_year":"D. MMMM[ta] H:mm","long_no_year_no_time":"D. MMMM[ta]","long_with_year":"D. MMMM[ta] YYYY H:mm","long_with_year_no_time":"D. MMMM[ta] YYYY","long_date_with_year":"D. MMMM[ta] YYYY LT","long_date_without_year":"D. MMMM[ta] LT","long_date_with_year_without_time":"D. MMMM[ta] YYYY","long_date_without_year_with_linebreak":"D. MMMM[ta] \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"D. MMMM[ta] YYYY \u003cbr/\u003eLT","tiny":{"half_a_minute":"\u003c 1 min","less_than_x_seconds":{"one":"\u003c 1 s","other":"\u003c %{count} s"},"x_seconds":{"one":"1 s","other":"%{count} s"},"less_than_x_minutes":{"one":"\u003c 1 min","other":"\u003c %{count} min"},"x_minutes":{"one":"1 min","other":"%{count} min"},"about_x_hours":{"one":"1 t","other":"%{count} t"},"x_days":{"one":"1 pv","other":"%{count} pv"},"about_x_years":{"one":"1 v","other":"%{count} v"},"over_x_years":{"one":"\u003e 1 v","other":"\u003e %{count} v"},"almost_x_years":{"one":"1 v","other":"%{count} v"},"date_month":"D. MMM","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"1 minuutti","other":"%{count} minuuttia"},"x_hours":{"one":"tunti","other":"%{count} tuntia"},"x_days":{"one":"1 päivä","other":"%{count} päivää"},"date_year":"D. MMMM[ta] YYYY"},"medium_with_ago":{"x_minutes":{"one":"1 minuutti sitten","other":"%{count} minuuttia sitten"},"x_hours":{"one":"tunti sitten","other":"%{count} tuntia sitten"},"x_days":{"one":"1 päivä sitten","other":"%{count} päivää sitten"}}},"share":{"topic":"jaa linkki tähän ketjuun","post":"jaa linkki viestiin #%{postNumber}","close":"sulje","twitter":"jaa tämä linkki Twitterissä","facebook":"jaa tämä linkki Facebookissa","google+":"jaa tämä linkki Google+:ssa","email":"lähetä tämä linkki sähköpostissa"},"edit":"muokkaa tämän ketjun otsikkoa ja aluetta","not_implemented":"Tätä toimintoa ei ole vielä toteutettu, pahoittelut!","no_value":"Ei","yes_value":"Kyllä","generic_error":"On tapahtunut virhe.","generic_error_with_reason":"Tapahtui virhe: %{error}","sign_up":"Luo tili","log_in":"Kirjaudu sisään","age":"Ikä","joined":"Liittynyt","admin_title":"Ylläpito","flags_title":"Liput","show_more":"näytä lisää","links":"Linkit","links_lowercase":"linkit","faq":"UKK","guidelines":"Ohjeet","privacy_policy":"Rekisteriseloste","privacy":"Yksityisyys","terms_of_service":"Käyttöehdot","mobile_view":"Mobiilinäkymä","desktop_view":"Työpöytänäkymä","you":"Sinä","or":"tai","now":"juuri nyt","read_more":"lue lisää","more":"Lisää","less":"Vähemmän","never":"ei koskaan","daily":"päivittäin","weekly":"viikottain","every_two_weeks":"kahden viikon välein","max":"maksimi","character_count":{"one":"{{count}} merkki","other":"{{count}} merkkiä"},"in_n_seconds":{"one":"sekunnissa","other":"{{count}} sekunnissa"},"in_n_minutes":{"one":"minuutissa","other":"{{count}} minuutissa"},"in_n_hours":{"one":"tunnissa","other":"{{count}} tunnissa"},"in_n_days":{"one":"päivässä","other":"{{count}} päivässä"},"suggested_topics":{"title":"Suositellut ketjut"},"about":{"simple_title":"Tietoja","title":"Tietoja sivustosta %{title}","stats":"Sivuston tilastot","our_admins":"Ylläpitäjät","our_moderators":"Valvojat","stat":{"all_time":"Kaikki","last_7_days":"Viimeiset 7 päivää"},"like_count":"Tykkäyksiä","topic_count":"Ketjuja","post_count":"Viestejä","user_count":"Käyttäjiä"},"bookmarks":{"not_logged_in":"pahoittelut, sinun täytyy kirjautua sisään voidaksesi lisätä viestin kirjanmerkin","created":"olet lisännyt tämän viestin kirjainmerkkeihisi","not_bookmarked":"olet lukenut tämän viestin, klikkaa lisätäksesi sen kirjanmerkkeihisi","last_read":"tämä on viimeisin viesti jonka olet lukenut, klikkaa lisätäksesi sen kirjanmerkkeihisi","remove":"Poista kirjanmerkki"},"topic_count_latest":{"one":"{{count}} uusi tai päivittynyt ketju.","other":"{{count}} uutta tai päivittynyttä ketjua."},"topic_count_unread":{"one":"{{count}} lukematon ketju.","other":"{{count}} lukematonta ketjua."},"topic_count_new":{"one":"{{count}} uusi ketju.","other":"{{count}} uutta ketjua."},"click_to_show":"Klikkaa avataksesi.","preview":"esikatselu","cancel":"peruuta","save":"Tallenna muutokset","saving":"Tallennetaan...","saved":"Tallennettu!","upload":"Lähetä","uploading":"Lähettää...","uploaded":"Lähetetty!","enable":"Ota käyttöön","disable":"Poista käytöstä","undo":"Peru","revert":"Palauta","failed":"Epäonnistui","banner":{"close":"Sulje tämä banneri."},"choose_topic":{"none_found":"Yhtään ketjua ei löydetty.","title":{"search":"Etsi ketjua nimen, url:n tai id:n perusteella","placeholder":"kirjoita ketjun otsikko tähän"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e kirjoitti \u003ca href='{{topicUrl}}'\u003eketjuun\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eSinä\u003c/a\u003e kirjoitit \u003ca href='{{topicUrl}}'\u003eketjuun\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e vastasi \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eSinä\u003c/a\u003e vastasit \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e vastasi \u003ca href='{{topicUrl}}'\u003eketjuun\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eSinä\u003c/a\u003e vastasit \u003ca href='{{topicUrl}}'\u003eketjuun\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e mainitsi \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e mainitsi \u003ca href='{{user2Url}}'\u003esinut\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eSinä\u003c/a\u003e mainitsit \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Kirjoittaja \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Kirjoittaja \u003ca href='{{userUrl}}'\u003esinä\u003c/a\u003e","sent_by_user":"Lähettäjä \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Lähettäjä \u003ca href='{{userUrl}}'\u003esinä\u003c/a\u003e"},"groups":{"visible":"Ryhmä näkyy kaikille käyttäjille","title":{"one":"ryhmä","other":"ryhmät"},"members":"Jäsenet","posts":"Viestit","alias_levels":{"title":"Kuka voi käyttää tätä ryhmää aliaksena?","nobody":"Ei kukaan","only_admins":"Vain ylläpitäjät","mods_and_admins":"Vain ylläpitäjät ja valvojat","members_mods_and_admins":"Vain ryhmän jäsenet, valvojat ja ylläpitäjät","everyone":"Kaikki"}},"user_action_groups":{"1":"Annetut tykkäykset","2":"Saadut tykkäykset","3":"Kirjanmerkit","4":"Ketjut","5":"Viestit","6":"Vastaukset","7":"Viittaukset","9":"Lainaukset","10":"Tähdelliset","11":"Muokkaukset","12":"Lähetetyt","13":"Postilaatikko"},"categories":{"all":"kaikki alueet","all_subcategories":"kaikki","no_subcategory":"alueettomat","category":"Alue","posts":"Viestit","topics":"Ketjut","latest":"Tuoreimmat","latest_by":"tuorein","toggle_ordering":"vaihda järjestystä","subcategories":"Sisemmät alueet","topic_stats":"Uusien ketjujen lukumäärä.","topic_stat_sentence":{"one":"%{count} uusi ketju viimeisen %{unit} aikana.","other":"%{count} uutta ketjua viimeisen %{unit} aikana."},"post_stats":"Uusien viestien lukumäärä.","post_stat_sentence":{"one":"%{count} uusi viesti viimeisen %{unit} aikana.","other":"%{count} uutta viestiä viimeisen %{unit} aikana."}},"ip_lookup":{"title":"IP osoitteen haku","hostname":"Isäntänimi","location":"Sijainti","location_not_found":"(tuntematon)","organisation":"Yritys","phone":"Puhelin","other_accounts":"Muut tilit samasta IP osoitteesta","no_other_accounts":"(ei mitään)"},"user":{"said":"{{username}} sanoi:","profile":"Profiili","mute":"Vaimenna","edit":"Muokkaa asetuksia","download_archive":"lataa arkisto viesteistäsi","private_message":"Yksityisviesti","private_messages":"Viestit","activity_stream":"Toiminta","preferences":"Asetukset","bookmarks":"Kirjanmerkit","bio":"Tietoa minusta","invited_by":"Kutsuja","trust_level":"Luottamustaso","notifications":"Ilmoitukset","disable_jump_reply":"Älä siirry uuteen viestiin sen lähettämisen jälkeen","dynamic_favicon":"Näytä ilmoitukset viesteistä faviconissa (kokeellinen)","edit_history_public":"Anna muiden nähdä viestieni revisiot","external_links_in_new_tab":"Avaa sivuston ulkopuoliset linkit uudessa välilehdessä","enable_quoting":"Ota käyttöön viestin lainaaminen tekstiä valitsemalla","change":"vaihda","moderator":"{{user}} on valvoja","admin":"{{user}} on ylläpitäjä","moderator_tooltip":"Tämä käyttäjä on valvoja","admin_tooltip":"Tämä käyttäjä on ylläpitäjä","suspended_notice":"Tämä käyttäjätili on hyllytetty {{date}} asti.","suspended_reason":"Syy:","mailing_list_mode":"Lähetä sähköposti jokaisesta uudesta viestistä (paitsi vaimennetuista ketjuista ja alueilta).","watched_categories":"Tarkkaillut","watched_categories_instructions":"Näiden alueiden ketjut asetetaan automaattisesti tarkkailuun. Saat ilmoituksen kaikista uusista viesteistä ja ketjuista ja uusien ja lukemattomien viestien lukumäärä näytetään ketjujen listauksissa. ","tracked_categories":"Seuratut","tracked_categories_instructions":"Näiden alueiden ketjut asetetaan automaattisesti seurantaan. Uusien ja lukemattomien viestien lukumäärä näytetään ketjujen listauksissa.","muted_categories":"Vaimennetut","muted_categories_instructions":"Et saa imoituksia uusista viesteistä näillä alueilla, eivätkä ne näy Lukemattomat-välilehdellä.","delete_account":"Poista tilini","delete_account_confirm":"Oletko varma, että haluat lopullisesti poistaa käyttäjätilisi? Tätä toimintoa ei voi perua!","deleted_yourself":"Käyttäjätilisi on poistettu.","delete_yourself_not_allowed":"Et voi poistaa käyttäjätiliäsi juuti nyt. Sinun tulee pyytää ylläpitäjää poistamaan tilisi.","unread_message_count":"Viestit","staff_counters":{"flags_given":"hyödyllisiä liputuksia","flagged_posts":"liputettuja viestejä","deleted_posts":"poistettuja viestejä","suspensions":"hyllytyksiä"},"messages":{"all":"Kaikki","mine":"Omat","unread":"Lukemattomat"},"change_password":{"success":"(sähköposti lähetetty)","in_progress":"(lähettää sähköpostia)","error":"(virhe)","action":"Lähetä sähköposti salasanan uusimista varten","set_password":"Aseta salasana"},"change_about":{"title":"Muokkaa kuvaustasi"},"change_username":{"title":"Vaihda käyttäjätunnus","confirm":"Jos vaihdat käyttäjätunnustasi, kaikki aiemmat lainaukset viesteistäsi ja @nimen maininnat menevät rikki. Oletko ehdottoman varma, että haluat tehdä näin?","taken":"Pahoittelut, tuo nimi on jo käytössä.","error":"Käyttäjätunnuksen vaihdossa tapahtui virhe.","invalid":"Käyttäjätunnus ei kelpaa. Se saa koostua ainoastaan numeroista ja kirjaimista."},"change_email":{"title":"Vaihda sähköposti","taken":"Pahoittelut, tämä sähköpostiosoite ei ole saatavilla.","error":"Sähköpostiosoitteen vaihdossa tapahtui virhe. Ehkäpä sama sähköpostiosoite on jo käytössä?","success":"Annettuun osoitteeseen on lähetetty viesti. Seuraa sen ohjeita sähköpostiosoitteen varmentamiseksi."},"change_avatar":{"title":"Vaihda avatarisi","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, osoitteesta","refresh_gravatar_title":"Päivitä Gravatar","letter_based":"Järjestelmän luoma avatar","uploaded_avatar":"Oma kuva","uploaded_avatar_empty":"Lisää oma kuva","upload_title":"Lataa oma kuva","upload_picture":"Lähetä kuva","image_is_not_a_square":"Varoitus: olemme rajanneet kuvaasti; se ei ole neliön muotoinen."},"change_profile_background":{"title":"Profiilin taustakuva"},"email":{"title":"Sähköposti","instructions":"Ei missään tilanteessa näytetä julkisesti.","ok":"Hyvältä näyttää. Lähetämme sinulle sähköpostin varmistukseksi.","invalid":"Ole hyvä ja anna toimiva sähköpostiosoite.","authenticated":"{{provider}} on todentanut sähköpostisi.","frequency":"Lähetämme sähköpostia vain aiheista, joita et ole nähnyt, ja kun emme ole nähneet sinua viime aikoina."},"name":{"title":"Nimi","instructions":"Nimesi pidempi muoto.","too_short":"Nimesi on liian lyhyt.","ok":"Nimesi vaikuttaa hyvältä."},"username":{"title":"Käyttäjätunnus","instructions":"Täytyy olla uniikki, lyhyt ja ilman välilyöntejä.","short_instructions":"Muut käyttäjät voivat viitata sinuun nimellä @{{username}}.","available":"Käyttäjätunnuksesi on vapaana.","global_match":"Sähköposti vastaa rekisteröityä käyttäjänimeä.","global_mismatch":"Nimi on jo käytössä. Kokeile {{suggestion}}?","not_available":"Ei saatavilla. Kokeile {{suggestion}}?","too_short":"Käyttäjätunnus on liian lyhyt.","too_long":"Käyttäjätunnus on liian pitkä.","checking":"Tarkistetaan käyttäjätunnusta...","enter_email":"Käyttäjänimi löydetty. Kirjoita sitä vastaava sähköpostiosoite.","prefilled":"Sähköposti vastaa tätä käyttäjänimeä."},"locale":{"title":"Käyttöliittymän kieli","instructions":"Käyttöliittymän kieli. Kieli vaihtuu sivun uudelleen lataamisen yhteydessä.","default":"(oletus)"},"password_confirmation":{"title":"Salasana uudelleen"},"last_posted":"Viimeinen viesti","last_emailed":"Viimeksi lähetetty sähköpostitse","last_seen":"Nähty","created":"Liittynyt","log_out":"Kirjaudu ulos","location":"Sijainti","website":"Nettisivu","email_settings":"Sähköposti","email_digests":{"title":"Lähetä tiivistelmä uusista viesteistä sähköpostilla, jos en käy sivustolla ","daily":"päivittäin","weekly":"viikottain","bi_weekly":"joka toinen viikko"},"email_direct":"Lähetä sähköposti jos joku lainaa viestiäni, vastaa viestiini tai viittaa @nimeeni.","email_private_messages":"Lähetä sähköposti jos joku lähettää minulle yksityisviestin","email_always":"Älä jätä lähettämättä sähköposti-ilmoituksia, vaikka olen aktiivinen palstalla.","other_settings":"Muut","categories_settings":"Keskustelualueet","new_topic_duration":{"label":"Tulkitse ketju uudeksi, kun","not_viewed":"en ole avannut sitä vielä","last_here":"se on luotu edellisen käyntisi jälkeen","after_n_days":{"one":"se on luotu edellisen päivän aikana","other":"se on luotu edellisen {{count}} päivän aikana"},"after_n_weeks":{"one":"se on luotu edellisen viikon aikana","other":"se on luotu edellisen {{count}} viikon aikana"}},"auto_track_topics":"Seuraa automaattisesti ketjuja","auto_track_options":{"never":"ei koskaan","always":"aina","after_n_seconds":{"one":"yhden sekunnin jälkeen","other":"{{count}} sekunnin jälkeen"},"after_n_minutes":{"one":"yhden minuutin jälkeen","other":"{{count}} minuutin jälkeen"}},"invited":{"search":"kirjoita etsiäksesi kutsuja...","title":"Kutsut","user":"Kutsuttu käyttäjä","none":"Et ole vielä kutsunut ketään.","truncated":"Näytetään ensimmäiset {{count}} kutsua.","redeemed":"Hyväksytyt kutsut","redeemed_at":"Hyväksytty","pending":"Odottavat kutsut","topics_entered":"Avatut ketjut","posts_read_count":"Luetut viestit","expired":"Tämä kutsu on rauennut.","rescind":"Poista","rescinded":"Kutsu poistettu","time_read":"Lukuaika","days_visited":"Päiviä vierailtu","account_age_days":"Tilin ikä päivissä","create":"Lähetä kutsu","bulk_invite":{"none":"Et ole kutsunut vielä ketään. Voit lähettää yksittäisiä kutsuja tai kutsua useita ihmisiä kerralla \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003elähettämällä massakutsun tiedostosta\u003c/a\u003e.","text":"Lähetä massakutsu tiedostosta","uploading":"LÄHETTÄÄ","success":"Tiedoston lähettäminen onnistui, saat pikaisesti ilmoituksen edistymisestä.","error":"Tiedoston '{{filename}}' lähetyksen aikana tapahtui virhe: {{message}}"}},"password":{"title":"Salasana","too_short":"Salasanasi on liian lyhyt.","common":"Annettu salasana on liian yleinen.","ok":"Salasana vaikuttaa hyvältä.","instructions":"Täytyy koostua vähintään %{count} merkistä."},"ip_address":{"title":"Viimeinen IP-osoite"},"registration_ip_address":{"title":"IP osoite rekisteröityessä"},"avatar":{"title":"Avatar"},"title":{"title":"Otsikko"},"filters":{"all":"Kaikki"},"stream":{"posted_by":"Viestin kirjoittaja","sent_by":"Lähettänyt","private_message":"yksityisviesti","the_topic":"ketju"}},"loading":"Lataa...","errors":{"prev_page":"yrittäessä ladata","reasons":{"network":"Verkkovirhe","server":"Palvelinvirhe","forbidden":"Pääsy estetty","unknown":"Virhe"},"desc":{"network":"Tarkasta internetyhteytesi.","network_fixed":"Näyttäisi palanneen takaisin.","server":"Virhekoodi: {{status}}","unknown":"Jotain meni pieleen."},"buttons":{"back":"Mene takaisin","again":"Yritä uudestaan","fixed":"Lataa sivu"}},"close":"Sulje","assets_changed_confirm":"Sivustolla on tehty päivityksiä. Ladataanko uudelleen?","read_only_mode":{"enabled":"Ylläpitäjä on käynnistänyt vain luku -tilan. Voit jatkaa sivuston selaamista, mutta osa toiminallisuudesta on poistettu käytöstä.","login_disabled":"Kirjautuminen ei ole käytössä sivuston ollessa vain luku -tilassa."},"too_few_topics_notice":"Luo vähintään 5 julkista ketjua ja %{posts} julkista viestiä käynnistääksesi keskustelun. Uudet käyttäjät eivät voi saavuttaa korkeampia luottamustasoja, jos luettavaa sisältöä ei ole tarpeeksi. Tämä viesti näkyy vain henkilökunnalle.","learn_more":"opi lisää...","year":"vuosi","year_desc":"viimeisen 365 päivän aikana luodut ketjut","month":"kuukausi","month_desc":"viimeisen 30 päivän aikana luodut ketjut","week":"viikko","week_desc":"viimeisen 7 päivän aikana luodut ketjut","day":"päivä","first_post":"Ensimmäinen viesti","mute":"Vaienna","unmute":"Poista vaimennus","last_post":"Viimeisin viesti","last_post_lowercase":"viimeisin viesti","summary":{"enabled_description":"Tarkastelet tiivistelmää tästä ketjusta, sen mielenkiintoisimpia viestejä käyttäjien toiminnan perusteella.","description":"Tässä kejussa on \u003cb\u003e{{count}}\u003c/b\u003e viestiä.","description_time":"Ketjussa on \u003cb\u003e{{count}}\u003c/b\u003e viestiä, joiden arvioitu lukemisaika on \u003cb\u003e{{readingTime}} minuuttia\u003c/b\u003e.","enable":"Näytä ketjun tiivistelmä","disable":"Näytä kaikki viestit"},"deleted_filter":{"enabled_description":"Tämä ketju sisältää poistettuja viestejä, jotka on piilotettu.","disabled_description":"Näytetään myös poistetut viestit.","enable":"Piilota poistetut viestit","disable":"Näytä poistetut viestit"},"private_message_info":{"title":"Yksityisviesti","invite":"Kutsu muita...","remove_allowed_user":"Haluatko varmasti poistaa käyttäjän {{name}} tästä yksityisestä keskustelusta?"},"email":"Sähköposti","username":"Käyttäjätunnus","last_seen":"Nähty","created":"Luotu","created_lowercase":"luotu","trust_level":"Luottamustaso","search_hint":"käyttäjänimi tai sähköposti","create_account":{"title":"Luo uusi tunnus","failed":"Jotain meni pieleen. Ehkäpä tämä sähköpostiosoite on jo rekisteröity, kokeile salasana unohtui -linkkiä."},"forgot_password":{"title":"Salasana unohtui","action":"Unohdin salasanani","invite":"Syötä käyttäjätunnuksesi tai sähköpostiosoitteesi, niin lähetämme sinulle salasanan nollausviestin.","reset":"Nollaa salasana","complete_username":"Jos käyttäjätunnusta \u003cb\u003e%{username}\u003c/b\u003e vastaava tili löytyy, saat kohta sähköpostin, jossa on lisäohjeet salasanan uusimiseen.","complete_email":"Jos sähköpostiosoitetta \u003cb\u003e%{email}\u003c/b\u003e vastaava tili löytyy, saat kohta sähköpostin, jossa on lisäohjeet salasanan uusimiseen."},"login":{"title":"Kirjaudu sisään","username":"Käyttäjä","password":"Salasana","email_placeholder":"sähköposti tai käyttäjätunnus","caps_lock_warning":"Caps Lock on päällä","error":"Tuntematon virhe","blank_username_or_password":"Kirjoita sähköpostiosoite tai käyttäjänimi ja salasana.","reset_password":"Nollaa salasana","logging_in":"Kirjaudutaan...","or":"Tai","authenticating":"Autentikoidaan...","awaiting_confirmation":"Käyttäjätilisi odottaa vahvistusta. Käytä salasana unohtui -linkkiä lähettääksesi uuden vahvistusviestin.","awaiting_approval":"Henkilökunta ei ole vielä hyväksynyt käyttäjätiliäsi. Saat sähköpostiviestin, kun tunnuksesi on hyväksytty.","requires_invite":"Pahoittelut, tämä palsta on vain kutsutuille käyttäjille.","not_activated":"Et voi vielä kirjautua sisään. Lähetimme aiemmin vahvistusviestin osoitteeseen \u003cb\u003e{{sentTo}}\u003c/b\u003e. Seuraa viestin ohjeita ottaaksesi tunnuksen käyttöön.","resend_activation_email":"Klikkaa tästä lähettääksesi vahvistusviestin uudelleen.","sent_activation_email_again":"Lähetimme uuden vahvistusviestin sinulle osoitteeseen \u003cb\u003e{{sentTo}}\u003c/b\u003e. Viestin saapumisessa voi kestää muutama minuutti, muista tarkastaa myös roskapostikansio.","google":{"title":"Googlella","message":"Todennetaan Googlen kautta (varmista, että ponnahdusikkunoiden esto ei ole päällä)"},"google_oauth2":{"title":"Googlella","message":"Todennetaan Googlen kautta (varmista, että ponnahdusikkunoiden esto ei ole päällä)"},"twitter":{"title":"Twitterillä","message":"Todennetaan Twitterin kautta (varmista, että ponnahdusikkunoiden esto ei ole päällä)"},"facebook":{"title":"Facebookilla","message":"Todennetaan Facebookin kautta (varmista, että ponnahdusikkunoiden esto ei ole päällä)"},"yahoo":{"title":"Yahoolla","message":"Todennetaan Yahoon kautta (varmista, että ponnahdusikkunoiden esto ei ole päällä)"},"github":{"title":"GitHubilla","message":"Todennetaan Githubin kautta (varmista, että ponnahdusikkunoiden esto ei ole päällä)"}},"composer":{"posting_not_on_topic":"Mihin ketjuun haluat vastata?","saving_draft_tip":"tallennetaan","saved_draft_tip":"tallennettu","saved_local_draft_tip":"tallennettu omalla koneella","similar_topics":"Tämä ketju vaikuttaa samalta kuin..","drafts_offline":"offline luonnokset","min_length":{"need_more_for_title":"Tarvitaan vielä {{n}} merkkiä otsikkoon","need_more_for_reply":"Tarvitaan vielä {{n}} merkkiä kirjoitukseen"},"error":{"title_missing":"Otsikko on pakollinen","title_too_short":"Otsikon täytyy olla vähintään {{min}} merkkiä pitkä","title_too_long":"Otsikko voi olla korkeintaan {{max}} merkkiä pitkä","post_missing":"Viesti ei voi olla tyhjä","post_length":"Viestissä täytyy olla vähintään {{min}} merkkiä","category_missing":"Sinun täytyy valita viestille alue"},"save_edit":"Tallenna muokkaus","reply_original":"Vastaa alkuperäiseen ketjuun","reply_here":"Vastaa tänne","reply":"Vastaa","cancel":"Peruuta","create_topic":"Luo uusi ketju","create_pm":"Luo uusi yksityisviesti","title":"Tai paina Ctrl+Enter","users_placeholder":"Lisää käyttäjä","title_placeholder":"Kuvaile lyhyesti mistä tässä ketjussa on kyse?","edit_reason_placeholder":"miksi muokkaat viestiä?","show_edit_reason":"(lisää syy muokkaukselle)","reply_placeholder":"Kirjoita viestisi tähän. Voit muotoilla tekstiä Markdown tai BBCode -komennoilla. Voit lisätä kuvia joko raahaamalla hiirellä tai Liitä-komennolla.","view_new_post":"Katsele uutta viestiäsi.","saving":"Tallennetaan...","saved":"Tallennettu!","saved_draft":"Sinulla on viestiluonnos kesken. Klikkaa tätä palkkia jatkaaksesi kirjoittamista.","uploading":"Lähettää...","show_preview":"näytä esikatselu \u0026raquo;","hide_preview":"\u0026laquo; piilota esikatselu","quote_post_title":"Lainaa koko viesti","bold_title":"Lihavoitettu","bold_text":"lihavoitettu teksti","italic_title":"Kursiivi","italic_text":"kursivoitu teksti","link_title":"Hyperlinkki","link_description":"kirjoita linkin kuvaus tähän","link_dialog_title":"Lisää linkki","link_optional_text":"vaihtoehtoinen kuvaus","quote_title":"Lainaus","quote_text":"Lainaus","code_title":"Teksti ilman muotoiluja","code_text":"Sisennä teksti neljällä välilyönnillä poistaaksesi automaattisen muotoilun","upload_title":"Lähetä","upload_description":"kirjoita ladatun tiedoston kuvaus tähän","olist_title":"Numeroitu lista","ulist_title":"Luettelomerkillinen luettelo","list_item":"Listan alkio","heading_title":"Otsikko","heading_text":"Otsikko","hr_title":"Vaakaviiva","undo_title":"Peru","redo_title":"Tee uudestaan","help":"Markdown apu","toggler":"näytä tai piilota kirjoitusalue","admin_options_title":"Tämän ketjun vain henkilökunnalle näytettävät asetukset","auto_close_label":"Sulje ketju automaattisesti tämän ajan jälkeen:","auto_close_units":"(# tuntia, kellonaika, tai aikaleima)","auto_close_examples":"syötä absoluuttinen aika tai aika tunteina — 24, 17:00, 2013-11-22 14:00","auto_close_error":"Ole hyvä ja syötä kelpaava arvo."},"notifications":{"title":"ilmoitukset @nimeen viittauksista, vastauksista omiin viesteihin ja ketjuihin, yksityisviesteistä ym.","none":"Sinulla ei ole ilmoituksia.","more":"vanhat ilmoitukset","total_flagged":"yhteensä liputettuja viestejä","mentioned":"\u003ci title='viittasi' class='icon'\u003e@\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='lainasi' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='vastasi' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='vastasi' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='muokkasi' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='tykkäsi' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","private_message":"\u003ci title='yksityisviesti' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='yksityisviesti' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='hyväksyi kutsusi' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e hyväksyi kutsusi\u003c/p\u003e","moved_post":"\u003ci title='siirsi viestin' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e siirsi {{description}}\u003c/p\u003e","linked":"\u003ci title='linkattu viesti' class='fa fa-arrow-left'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='arvomerkki myönnetty' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eAnsaitsit '{{description}}'\u003c/p\u003e"},"upload_selector":{"title":"Lisää kuva","title_with_attachments":"Lisää kuva tai tidosto","from_my_computer":"Tästä laitteesta","from_the_web":"Netistä","remote_tip":"linkki kuvaan http://esimerkki.fi/kuva.jpg","remote_tip_with_attachments":"linkki kuvaan tai tiedostoon http://esimerkki.fi/tiedosto.txt (sallitut tiedostopäätteet: {{authorized_extensions}}).","local_tip":"Klikkaa tästä ladataksesi kuvan laitteeltasi","local_tip_with_attachments":"klikkaa valitaksesi kuvan tai tiedoston laitteeltasi (sallitut tiedostopäätteet: {{authorized_extensions}}).","hint":"(voit myös raahata ne editoriin ladataksesi ne sivustolle)","hint_for_supported_browsers":"(voit myös raahata tai liittää kuvia editoriin ladataksesi ne sivustolle)","uploading":"Lähettää","image_link":"linkki, johon kuvasi osoittaa"},"search":{"title":"etsi ketjuja, viestejä, käyttäjiä tai alueita","no_results":"Ei tuloksia.","searching":"Etsitään ...","post_format":"#{{post_number}} käyttäjältä {{username}}","context":{"user":"Etsi @{{username}} viestejä","category":"Etsi alueelta \"{{category}}\"","topic":"Etsi tästä ketjusta"}},"site_map":"siirry toiseen ketjuun tai alueelle","go_back":"mene takaisin","not_logged_in_user":"käyttäjäsivu, jossa on tiivistelmä käyttäjän viimeaikaisesta toiminnasta sekä käyttäjäasetukset","current_user":"siirry omalle käyttäjäsivullesi","starred":{"title":"Merkitse tähdellä","help":{"star":"lisää tämä ketju tähdellisten listaan","unstar":"poista tämä ketju tähdellisten listalta"}},"topics":{"bulk":{"reset_read":"Palauta lukutila","delete":"Poista ketjuja","dismiss_posts":"Unohda viestit","dismiss_posts_tooltip":"Tyhjennä nyt ilmoitukset lukemattomista viesteistä näiden ketjujen osalta, mutta näytä ilmoitukset uudestaan, kun ketjuihin kirjoitetaan uusia viestejä.","dismiss_topics":"Unohda ketjut","dismiss_topics_tooltip":"Lakkaa pysyvästi näyttämästä ilmoituksia uusista viesteistä näissä ketjuissa.","dismiss_new":"Unohda uudet","toggle":"Vaihda useamman ketjun valintaa","actions":"Massatoiminnot","change_category":"Vaihda aluetta","close_topics":"Sulje ketjut","notification_level":"Vaihda ilmoitusasetusta","selected":{"one":"Olet valinnut \u003cb\u003eyhden\u003c/b\u003e ketjun.","other":"Olet valinnut \u003cb\u003e{{count}}\u003c/b\u003e ketjua."}},"none":{"starred":"Et ole merkinnyt yhtään ketjua tähdellä. Merkitäksesi ketjun, klikkaa tai hipaise tähteä ketjun otsikon vieressä.","unread":"Sinulla ei ole lukemattomia ketjuja.","new":"Sinulla ei ole uusia ketjuja.","read":"Et ole lukenut vielä yhtään yhtään ketjua.","posted":"Et ole kirjoittanut vielä yhteenkään ketjuun.","latest":"Tuoreimpia ketjuja ei ole. Ompa harmi.","hot":"Kuumia ketjuja ei ole.","category":"Alueella {{category}} ei ole ketjua.","top":"Huippuketjuja ei ole.","educate":{"new":"\u003cp\u003eKetjut tulkitaan uusiksi, kun ne on luotu viimeisen 2 päivän sisällä.\u003c/p\u003e\u003cp\u003eVoit muuttaa tätä oletusarvoa \u003ca href=\"%{userPrefsUrl}\"\u003ekäyttäjäasetuksistasi\u003c/a\u003e.\u003c/p\u003e","unread":"\u003cp\u003eLukemattomien viestien ilmoitukset näytetään ketjuista,\u003c/p\u003e\u003cul\u003e\u003cli\u003ejotka olet luonut\u003c/li\u003e\u003cli\u003ejoihin olet vastannut\u003c/li\u003e\u003cli\u003ejoita olet lukenut vähintään 4 minuuttia,\u003c/li\u003e\u003c/ul\u003e\u003cp\u003e tai jotka olet erikseen asettanut seurantaan tai tarkkailuun ketjun alta löytyvästä painikkeesta.\u003c/p\u003e\u003cp\u003eVoit muuttaa näitä oletusarvoja \u003ca href=\"%{userPrefsUrl}\"\u003ekäyttäjäasetuksistasi\u003c/a\u003e.\u003c/p\u003e"}},"bottom":{"latest":"Tuoreimpia ketjuja ei ole enempää.","hot":"Kuumia ketjuja ei ole enempää.","posted":"Ketjuja, joihin olet kirjoittanut ei ole enempää.","read":"Luettuja ketjuja ei ole enempää.","new":"Uusia ketjuja ei ole enempää.","unread":"Lukemattomia ketjuja ei ole enempää.","starred":"Tähdellisiä ketjuja ei ole enempää.","category":"Alueen {{category}} ketjuja ei ole enempää.","top":"Huippuketjuja ei ole enempää."}},"topic":{"filter_to":"{{post_count}} viestiä ketjussa","create":"Luo ketju","create_long":"Luo uusi ketju","private_message":"Luo yksityisviesti","list":"Ketjut","new":"uusi ketju","unread":"lukemattomat","new_topics":{"one":"1 uusi ketju","other":"{{count}} uutta ketjua"},"unread_topics":{"one":"1 lukematon ketju","other":"{{count}} lukematonta ketjua"},"title":"Ketju","loading_more":"Ladataan lisää ketjuja...","loading":"Ladataan ketjua...","invalid_access":{"title":"Tämä ketju on yksityinen","description":"Pahoittelut, sinulla ei ole pääsyä tähän ketjuun!","login_required":"Sinun täytyy kirjautua sisään nähdäksesi tämän ketjun."},"server_error":{"title":"Ketjun lataaminen epäonnistui","description":"Pahoittelut, ketjun lataaminen epäonnistui. Kyse saattaa olla yhteysongelmsta. Kokeile sivun lataamista uudestaan ja jos ongelma jatkuu, ota yhteyttä."},"not_found":{"title":"Ketjua ei löytynyt","description":"Pahoittelut, ketjua ei löytynyt. Ehkäpä valvoja on siirtänyt sen muualle?"},"total_unread_posts":{"one":"sinulla on 1 lukematon viesti tässä ketjussa","other":"sinulla on {{count}} lukematonta viestiä tässä ketjussa"},"unread_posts":{"one":"yksi vanha viesti on lukematta tässä ketjussa","other":"{{count}} vanhaa viestiä on lukematta tässä ketjussa"},"new_posts":{"one":"tähän ketjuun on tullut yksi uusi viesti sen jälkeen, kun edellisen kerran luit sen","other":"tähän ketjuun on tullut {{count}} uutta viestiä sen jälkeen, kun edellisen kerran luit sen"},"likes":{"one":"tässä ketjussa on yksi tykkäys","other":"tässä ketjussa on {{count}} tykkäystä"},"back_to_list":"Takaisin ketjulistaan","options":"Ketjun asetukset","show_links":"näytä tämän ketjun linkit","toggle_information":"näytä/kätke ketjun tiedot","read_more_in_category":"Haluatko lukea lisää? Selaa muita ketjuja alueella {{catLink}} tai {{latestLink}}.","read_more":"Haluatko lukea lisää? {{catLink}} tai {{latestLink}}.","browse_all_categories":"Selaa keskustelualueita","view_latest_topics":"katsele tuoreimpia ketjuja","suggest_create_topic":"Jospa aloittaisit uuden ketjun?","jump_reply_up":"hyppää aiempaan vastaukseen","jump_reply_down":"hyppää myöhempään vastaukseen","deleted":"Tämä ketju on poistettu","auto_close_notice":"Tämä ketju sulkeutuu automaattisesti %{timeLeft}.","auto_close_title":"Automaattisen sulkemisen asetukset","auto_close_save":"Tallenna","auto_close_remove":"Älä sulje tätä ketjua automaattisesti","progress":{"title":"ketjun edistyminen","go_top":"ylös","go_bottom":"alas","go":"mene","jump_bottom_with_number":"hyppää viestiin %{post_number}","total":"yhteensä viestejä","current":"tämänhetkinen viesti","position":"viesti %{current} / %{total}"},"notifications":{"reasons":{"3_6":"Saat ilmoituksia, koska olet asettanut tämän alueen tarkkailuun.","3_5":"Saat ilmoituksia, koska ketju on asetettu tarkkailuun automaattisesti.","3_2":"Saat ilmoituksia, koska olet asettanut ketjun tarkkailuun.","3_1":"Saat ilmoituksia, koska loit tämän ketjun.","3":"Saat ilmoituksia, koska olet asettanut ketjun tarkkailuun.","2_8":"Saat ilmoituksia, koska olet asettanut tämän alueen seurantaan.","2_4":"Saat ilmoituksia, koska olet kirjoittanut ketjuun viestin.","2_2":"Saat ilmoituksia, koska olet asettanut ketjun seurantaan.","2":"Saat ilmoituksia, koska \u003ca href=\"/users/{{username}}/preferences\"\u003eluet tätä ketjua\u003c/a\u003e.","1_2":"Saat ilmoituksen vain jos joku mainitsee @nimesi tai vastaa viestiisi.","1":"Saat ilmoituksen vain jos joku mainitsee @nimesi tai vastaa viestiisi.","0_7":"Et saa mitään ilmoituksia tältä alueelta.","0_2":"Et saa mitään ilmoituksia tästä ketjusta.","0":"Et saa mitään ilmoituksia tästä ketjusta."},"watching_pm":{"title":"Tarkkaile","description":"Saat ilmoituksen kaikista uusista viesteistä tässä yksityisviestiketjussa. Uusien ja lukemattomien viestien lukumäärä näytetään ketjun listauksissa."},"watching":{"title":"Tarkkaile","description":"Saat ilmoituksen kaikista uusista viesteistä tässä ketjussa. Uusien ja lukemattomien viestien lukumäärä ilmestyy näkyviin ketjun listauksissa."},"tracking_pm":{"title":"Seuraa","description":"Lukemattomien ja uusien viestien lukumäätä näytetään yksityisviestin yhteydessä. Saat ilmoituksen vain jos joku mainitsee @nimesi tai vastaa sinulle viestissään."},"tracking":{"title":"Seuraa","description":"Lukemattomien ja uusien viestien lukumäärä näytetään ketjujen listauksissa. Saat ilmoituksen vain jos joku mainitsee @nimesi tai vastaa sinulle viestissään."},"regular":{"title":"Tavallinen","description":"Saat ilmoituksen vain jos joku mainitsee @nimesi tai vastaa viestiisi."},"regular_pm":{"title":"Tavallinen","description":"Saat ilmoituksen vain jos joku mainitsee @nimesi tai vastaa viestiisi yksityisessä keskustelussa."},"muted_pm":{"title":"Vaimenna","description":"Et saa mitään ilmoituksia tästä yksityisviestistä."},"muted":{"title":"Vaimenna","description":"Et saa ilmoituksia mistään tässä ketjussa eikä se näy lukemattomat-välilehdessä."}},"actions":{"recover":"Peru ketjun poisto","delete":"Poista ketju","open":"Avaa ketju","close":"Sulje ketju","auto_close":"Automaattinen sulkeminen","make_banner":"Tee ketjusta banneri","remove_banner":"Poista banneri","unpin":"Poista ketjun kiinnitys","pin":"Kiinnitä ketju","pin_globally":"Kiinnitä ketju koko palstalle","unarchive":"Poista ketjun arkistointi","archive":"Arkistoi ketju","invisible":"Tee ketjusta näkymätön","visible":"Tee ketjusta näkyvä","reset_read":"Nollaa tiedot lukemisista","multi_select":"Valitse viestejä"},"reply":{"title":"Vastaa","help":"aloita kirjottamaan uutta vastausta tähän ketjuun"},"clear_pin":{"title":"Poista kiinnitys","help":"Poista kiinnitys, jotta ketju ei enää pysy listauksen ylimpänä"},"share":{"title":"Jaa","help":"jaa linkki tähän ketjuun"},"flag_topic":{"title":"Liputa","help":"liputa tämä ketju tai lähetä siitä yksityinen ilmoitus valvojalle","success_message":"Ketjun liputus onnistui."},"inviting":"Kutsutaan...","automatically_add_to_groups_optional":"Tämä kutsu sisältää automaattisesti pääsyn ryhmiin: (valinnainen, vain ylläpitäjille)","automatically_add_to_groups_required":"Tämä kutsu sisältää automaattisesti pääsyn ryhmiin: (\u003cb\u003eVaaditaan\u003c/b\u003e, vain ylläpitäjille)","invite_private":{"title":"Kutsu yksityisviestiin","email_or_username":"Kutsuttavan sähköpostiosoite tai käyttäjänimi","email_or_username_placeholder":"sähköpostiosoite tai käyttäjänimi","action":"Kutsu","success":"Käyttäjä on kutsuttu osallistumaan tähän yksityiseen keskusteluun.","error":"Pahoittelut, kutsuttaessa tapahtui virhe.","group_name":"ryhmän nimi"},"invite_reply":{"title":"Kutsu","action":"Sähköpostikutsu","help":"Lähetä kutsuja ystäville, jotta he voivat vastata tähän ketjuun yhdellä klikkauksella","to_topic":"Lähetämme lyhyen sähköpostin, jonka avulla ystäväsi voi heti vastata tähän ketjuun klikkaamalla linkkiä, ilman sisäänkirjautumista.","to_forum":"Lähetämme lyhyen sähköpostin jonka avulla ystäväsi voi liittyä klikkaamalla linkkiä, sisäänkirjautumista ei tarvita.","email_placeholder":"nimi@esimerkki.fi","success":"Olemme lähettäneet kutsun osoitteeseen \u003cb\u003e{{email}}\u003c/b\u003e. Ilmoitamme, kun kutsuun on vastattu. Voit seurata käyttäjäsivusi kutsut-välilehdeltä kutsujesi tilannetta.","error":"Pahoittelut, emme pystyneet kutsumaan tätä henkilöä. Ehkäpä hän on käyttäjä jo valmiiksi?"},"login_reply":"Kirjaudu sisään vastataksesi","filters":{"n_posts":{"one":"1 viesti","other":"{{count}} viestiä"},"cancel":"Näytä tämän ketjun kaikki viestit."},"split_topic":{"title":"Siirrä uuteen ketjuun","action":"siirrä uuteen ketjuun","topic_name":"Uuden ketjun otsikko","error":"Viestien siirtämisessä uuteen ketjuun tapahtui virhe.","instructions":{"one":"Olet luomassa uutta ketjua valitsemastasi viestistä.","other":"Olet luomassa uutta ketjua valitsemistasi \u003cb\u003e{{count}}\u003c/b\u003e viestistä."}},"merge_topic":{"title":"Siirrä olemassa olevaan ketjuun","action":"siirrä olemassa olevaan ketjuun","error":"Viestien siirtämisessä ketjuun tapahtui virhe.","instructions":{"one":"Valitse ketju, johon haluat siirtää viestin.","other":"Valitse ketju, johon haluat siirtää\u003cb\u003e{{count}}\u003c/b\u003e viestiä."}},"change_owner":{"title":"Vaihda viestin omistajaa","action":"muokkaa omistajuutta","error":"Viestin omistajan vaihdossa tapahtui virhe.","label":"Viestin uusi omistaja","placeholder":"uuden omistajan käyttäjätunnus","instructions":{"one":"Valitse uusi omistaja viestille käyttäjältä \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Valitse uusi omistaja {{count}} viestille käyttäjältä \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"Huomaa, että viestin ilmoitukset eivät siirry uudelle käyttäjälle automaattisesti. \u003cbr\u003e Varoitus: Tällä hetkellä mikään viestikohtainen data ei siirry uudelle käyttäjälle. Käytä varoen."},"multi_select":{"select":"valitse","selected":"valittuna ({{count}})","select_replies":"valitse +vastausta","delete":"poista valitut","cancel":"kumoa valinta","select_all":"valitse kaikki","deselect_all":"poista kaikkien valinta","description":{"one":"Olet valinnut \u003cb\u003eyhden\u003c/b\u003e viestin.","other":"Olet valinnut \u003cb\u003e{{count}}\u003c/b\u003e viestiä."}}},"post":{"reply":"Vastaus käyttäjän {{replyAvatar}} {{username}} viestiin {{link}}","reply_topic":"Vastaus ketjuun {{link}}","quote_reply":"lainaa","edit":"Viestin {{link}} muokkaus käyttäjältä {{replyAvatar}} {{username}}","edit_reason":"Syy:","post_number":"viesti {{number}}","in_reply_to":"vastauksena","last_edited_on":"viestin viimeinen muokkausaika","reply_as_new_topic":"Vastaa uudessa ketjussa","continue_discussion":"Jatkoa ketjulle {{postLink}}:","follow_quote":"siirry lainattuun viestiin","show_full":"Näytä koko viesti","show_hidden":"Näytä piilotettu sisältö.","deleted_by_author":{"one":"(kirjoittaja on perunut viestin ja se poistetaan automaattisesti tunnin kuluttua, paitsi jo se liputetaan)","other":"(kirjoittaja on perunut viestin ja se poistetaan automaattisesti %{count} tunnin kuluttua, paitsi jo se liputetaan)"},"expand_collapse":"laajenna/pienennä","gap":{"one":"1 piilotettu viesti","other":"{{count}} piilotettua viestiä"},"more_links":"{{count}} lisää...","unread":"Viesti on lukematon","has_replies":{"one":"Vastaus","other":"Vastaukset"},"errors":{"create":"Pahoittelut, viestin luonti ei onnistunut. Ole hyvä ja yritä uudelleen.","edit":"Pahoittelut, viestin muokkaus ei onnistunut. Ole hyvä ja yritä uudelleen.","upload":"Pahoittelut, tiedoston lähetys ei onnistunut. Ole hyvä ja yritä uudelleen.","attachment_too_large":"Pahoittelut, tiedosto jonka latausta yritit on liian suuri ( suurin tiedostokoko on {{max_size_kb}}kb).","image_too_large":"Pahoittelut, kuva jonka yritit ladata on liian suuri (suurin sallittu kuvakoko on {{max_size_kb}}kb), pienennä kuvaa ja yritä uudestaan.","too_many_uploads":"Pahoittelut, voit ladata vain yhden tiedoston kerrallaan.","upload_not_authorized":"Pahoittelut, tiedostomuoto ei ole sallittu (sallitut tiedostopäätteet: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Pahoittelut, uudet käyttjät eivät saa ladata kuvia.","attachment_upload_not_allowed_for_new_user":"Pahoittelut, uudet käyttäjät eivät saa ladata liitteitä."},"abandon":{"confirm":"Oletko varma, että haluat hylätä viestisi?","no_value":"Ei, säilytä","yes_value":"Kyllä, hylkää"},"wiki":{"about":"tämä viesti on wiki; peruskäyttäjät voivat muokata sitä"},"archetypes":{"save":"Tallennusasetukset"},"controls":{"reply":"aloita vastaamaan tähän viestiin","like":"tykkää viestistä","has_liked":"tykkäsit tästä viestistä","undo_like":"peru tykkäys","edit":"muokkaa viestiä","edit_anonymous":"Pahoittelut, sinun täytyy ensin kirjautua sisään voidaksesi muokata tätä viestiä.","flag":"liputa tämä viesti tai lähetä käyttäjälle yksityisviesti","delete":"poista tämä viesti","undelete":"peru viestin poistaminen","share":"jaa linkki tähän viestiin","more":"Lisää","delete_replies":{"confirm":{"one":"Haluatko poistaa myös yhden suoran vastauksen tähän viestiin.","other":"Haluatko poistaa myös {{count}} suoraa vastausta tähän viestiin?"},"yes_value":"Kyllä, poista myös vastaukset","no_value":"En, poista vain tämä viesti"},"admin":"viestin ylläpitotoimet","wiki":"Tee wiki","unwiki":"Poista wiki"},"actions":{"flag":"Liputa","defer_flags":{"one":"Lykkää lippua","other":"Lykkää lippuja"},"it_too":{"off_topic":"Liputa sinäkin","spam":"Liputa sinäkin","inappropriate":"Liputa sinäkin","custom_flag":"Liputa sinäkin","bookmark":"Lisää oma kirjanmerkki","like":"Tykkää sinäkin","vote":"Äänestä sinäkin"},"undo":{"off_topic":"Peru lippu","spam":"Peru lippu","inappropriate":"Peru lippu","bookmark":"Peru kirjanmerkki","like":"Peru tykkäys","vote":"Peru ääni"},"people":{"off_topic":"{{icons}} liputtivat tämän asiaan kuulumattomaksi","spam":"{{icons}} liputtivat tämän roskapostiksi","inappropriate":"{{icons}} liputtivat tämän asiattomaksi","notify_moderators":"{{icons}} ilmoittivat valvojille","notify_moderators_with_url":"{{icons}} \u003ca href='{{postUrl}}'\u003eilmoittivat valvojille\u003c/a\u003e","notify_user":"{{icons}} lähettivät yksityisviestin","notify_user_with_url":"{{icons}} lähettivät \u003ca href='{{postUrl}}'\u003eyksityisviestin\u003c/a\u003e","bookmark":"{{icons}} lisäsivät tämän kirjanmerkkeihinsä","like":"{{icons}} tykkäsivät tästä","vote":"{{icons}} äänestivät tätä"},"by_you":{"off_topic":"Liputit tämän asiaankuulumattomaksi","spam":"Liputit tämän roskapostiksi","inappropriate":"Liputit tämän asiattomaksi","notify_moderators":"Liputit tämän valvojille tiedoksi","notify_user":"Lähetit tälle käyttäjälle yksityisviestin","bookmark":"Olet lisännyt viestin kirjainmerkkeihisi","like":"Tykkäsit tästä","vote":"Olet äänestänyt tätä viestiä"},"by_you_and_others":{"off_topic":{"one":"Sinä ja yksi muu käyttäjä liputitte tämän asiaankuulumattomaksi","other":"Sinä ja {{count}} muuta liputtivat tämän asiaankuulumattomaksi"},"spam":{"one":"Sinä ja yksi muu käyttäjä liputitte tämän roskapostiksi","other":"Sinä ja {{count}} muuta liputtivat tämän roskapostiksi"},"inappropriate":{"one":"Sinä ja yksi muu käyttäjä liputitte tämän asiattomaksi","other":"Sinä ja {{count}} muuta liputtivat tämän asiattomaksi"},"notify_moderators":{"one":"Sinä ja yksi muu käyttäjä liputitte tämän valvojille tiedoksi","other":"Sinä ja {{count}} muuta liputtivat tämän valvojille tiedoksi"},"notify_user":{"one":"Sinä ja yksi muu käyttäjä lähetitte tälle käyttäjälle yksityisviestin","other":"Sinä ja {{count}} muuta lähettivät tälle käyttäjälle yksityisviestin"},"bookmark":{"one":"Sinä ja yksi muu käyttäjä lisäsitte tämän kirjanmerkkeihinne","other":"Sinä ja {{count}} muuta lisäsivät tämän kirjanmerkkeihinsä"},"like":{"one":"Sinä ja yksi muu käyttäjä tykkäsitte tästä","other":"Sinä ja {{count}} muuta tykkäsivät tästä"},"vote":{"one":"Sinä ja yksi muu käyttäjä äänestitte tätä viestiä","other":"Sinä ja {{count}} muuta äänestivät tätä viestiä"}},"by_others":{"off_topic":{"one":"Yksi käyttäjä liputti tämän asiaankuulumattomaksi","other":"{{count}} käyttäjää liputtivat tämän asiaankuulumattomaksi"},"spam":{"one":"yksi käyttäjä liputti tämän roskapostiksi","other":"{{count}} käyttäjää liputti tämän roskapostiksi"},"inappropriate":{"one":"yksi käyttäjä liputti tämän epäasialliseksi","other":"{{count}} käyttäjää liputti tämän epäasialliseksi"},"notify_moderators":{"one":"yksi käyttäjä liputti tämän tiedoksi valvojalle","other":"{{count}} käyttäjää liputti tämän tiedoksi valvojalle"},"notify_user":{"one":"yksi käyttäjä lähetti yksityisviestin tälle käyttäjälle","other":"{{count}} käyttäjää lähetti tälle käyttäjälle yksityisviestin"},"bookmark":{"one":"yksi käyttäjä lisäsi tämän viestin kirjanmerkkeihinsä","other":"{{count}} käyttäjää lisäsi tämän veistin kirjanmerkkeihinsä"},"like":{"one":"yksi käyttäjä tykkäsi tästä","other":"{{count}} käyttäjää tykkäsi tästä"},"vote":{"one":"yksi käyttäjä äänesti tätä viestiä","other":"{{count}} käyttäjää äänesti tätä viestiä"}}},"edits":{"one":"1 muokkaus","other":"{{count}} muokkausta","zero":"ei muokkauksia"},"delete":{"confirm":{"one":"Oletko varma, että haluat poistaa tämän viestin?","other":"Oletko varma, että haluat poistaa kaikki nämä viestit?"}},"revisions":{"controls":{"first":"Ensimmäinen revisio","previous":"Edellinen revisio","next":"Seuraava revisio","last":"Viimeinen revisio","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e vs \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Näytä lisäykset ja poistot tekstin osana","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Näytä muokkauksen versiot vierekkäin","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Näytä versioiden markdown-lähdekoodit vierekkäin","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Markdown"}},"details":{"edited_by":"Muokannut"}}},"category":{"can":"voivat\u0026hellip; ","none":"(ei aluetta)","choose":"Valitse alue\u0026hellip;","edit":"muokkaa","edit_long":"Muokkaa","view":"Katsele alueen ketjuja","general":"Yleistä","settings":"Asetukset","delete":"Poista alue","create":"Luo alue","save":"Tallenna alue","creation_error":"Alueen luonnissa tapahtui virhe.","save_error":"Alueen tallennuksessa tapahtui virhe.","name":"Alueen nimi","description":"Kuvaus","topic":"alueen kuvausketju","logo":"Alueen logo","background_image":"Alueen taustakuva","badge_colors":"Alueiden tunnusten värit","background_color":"Taustaväri","foreground_color":"Edustan väri","name_placeholder":"Yksi tai kaksi sanaa enimmillään","color_placeholder":"Mikä hyvänsä web-väri","delete_confirm":"Oletko varma, että haluat poistaa tämän alueen?","delete_error":"Alueen poistossa tapahtui virhe.","list":"Listaa alueet","no_description":"Lisää alueelle kuvaus.","change_in_category_topic":"Muokkaa kuvausta","already_used":"Tämä väri on jo käytössä toisella alueella","security":"Turvallisuus","images":"Kuvat","auto_close_label":"Sulje ketjut automaattisesti tämän ajan jälkeen:","auto_close_units":"tuntia","email_in":"Saapuvan postin sähköpostiosoite:","email_in_allow_strangers":"Hyväksy viestejä anonyymeiltä käyttäjiltä joilla ei ole tiliä","email_in_disabled":"Uusien ketjujen luominen sähköpostitse on otettu pois käytöstä sivuston asetuksissa. Salliaksesi uusien ketjujen luomisen sähköpostilla, ","email_in_disabled_click":"ota käyttöön \"email in\" asetus.","allow_badges_label":"Salli arvomerkkien myöntäminen tältä alueelta","edit_permissions":"Muokkaa oikeuksia","add_permission":"Lisää oikeus","this_year":"tänä vuonna","position":"asema","default_position":"Oletuspaikka","position_disabled":"Alueet näytetään aktiivisuusjärjestyksessä. Muokataksesi järjestystä,","position_disabled_click":"ota käyttöön \"pysyvä aluejärjestys\" asetuksista.","parent":"Ylempi alue","notifications":{"watching":{"title":"Tarkkaile","description":"Tämän alueen ketjut asetetaan automaattisesti tarkkailuun. Saat ilmoituksen kaikista uusista viesteistä ja ketjuista ja alueen uusien ja lukemattomien viestien lukumäärä näytetään ketjujen listauksissa. "},"tracking":{"title":"Seuraa","description":"Näiden alueiden ketjut asetetaan automaattisesti seurantaan. Uusien ja lukemattomien viestien lukumäärä näytetään ketjujen listauksissa."},"regular":{"title":"Tavallinen","description":"Saat ilmoituksen vain jos joku mainitsee @nimesi tai vastaa viestiisi."},"muted":{"title":"Vaimennettu","description":"Et saa imoituksia uusista viesteistä näillä alueilla, eivätkä ne näy Lukemattomat-välilehdellä"}}},"flagging":{"title":"Miksi haluat liputtaa tämän viestin?","action":"Liputa viesti","take_action":"Ryhdy toimiin","notify_action":"Yksityisviesti","delete_spammer":"Poista roskapostittaja","delete_confirm":"Olet aikeissa poistaa \u003cb\u003e%{posts}\u003c/b\u003e viestiä ja \u003cb\u003e%{topics}\u003c/b\u003e ketjua tältä käyttäjältä, sekä käyttäjätilin, estää tunnuksen luomisen tästä IP osoitteesta \u003cb\u003e%{ip_address}\u003c/b\u003e, ja lisätä sähköpostiosoitteen \u003cb\u003e%{email}\u003c/b\u003e pysyvästi estolistalle. Oletko varma, että tämä käyttäjä todella on roskapostittaja?","yes_delete_spammer":"Kyllä, poista roskapostittaja","submit_tooltip":"Toimita lippu","take_action_tooltip":"Saavuta liputusraja välittömästi, ennemmin kuin odota muidenkin käyttäjien liputuksia.","cant":"Pahoittelut, et pysty liputtamaan tätä viestiä tällä hetkellä.","custom_placeholder_notify_user":"Miksi tässä viestissä edellyttää sinua lähettämään yksityisviestin suoraan käyttäjälle? Esitä asiasi ymmärrettävästi, ole rakentava ja kohtelias.","custom_placeholder_notify_moderators":"Miksi tässä viestissä edellyttää valvojan toimia? Kirjoita ymmärrettävästi ja lisää viestiin oleelliset linkit jos mahdollista.","custom_message":{"at_least":"kirjoita vähintään {{n}} merkkiä","more":"vielä {{n}}...","left":"{{n}} jäljellä"}},"flagging_topic":{"title":"Miksi liputat tämän ketjun?","action":"Liputa ketju","notify_action":"Yksityisviesti"},"topic_map":{"title":"Ketjun tiivistelmä","links_shown":"Näytä kaikki {{totalLinks}} linkkiä...","clicks":{"one":"1 klikkaus","other":"%{count} klikkausta"}},"topic_statuses":{"locked":{"help":"Tämä ketju on suljettu; siihen ei voi enää vastata."},"unpinned":{"title":"Kiinnitys poistettu","help":"Ketjun kiinnitys on poistettu; se näytetään oletusjärjestyksessä."},"pinned_globally":{"title":"Kiinnitetty koko palstalle","help":"Tämä ketju on nyt kiinnitetty koko palstalle; se näytetään kaikkien listausten ylimpänä"},"pinned":{"title":"Kiinnitetty","help":"Tämä ketju on nostettu; se näytetään alueensa ensimmäisenä"},"archived":{"help":"Tämä ketju on arkistoitu; se on jäädytetty eikä sitä voi muuttaa"},"invisible":{"help":"Tämä ketju on näkymätön; sitä ei näytetä listauksissa ja siihen pääsee vain suoralla lnkillä"}},"posts":"Viestit","posts_lowercase":"viestit","posts_long":"tässä ketjussa on {{number}} viestiä","original_post":"Aloitusviesti","views":"Katselut","views_lowercase":"katselut","replies":"Vastaukset","views_long":"tätä ketjua on katseltu {{number}} kertaa","activity":"Toiminta","likes":"Tykkäykset","likes_lowercase":"tykkäykset","likes_long":"tässä ketjussa on {{number}} tykkäystä","users":"Käyttäjät","users_lowercase":"käyttäjät","category_title":"Alue","history":"Historia","changed_by":"käyttäjältä {{author}}","categories_list":"Lista alueista","filters":{"with_topics":"%{filter} ketjut","with_category":"%{filter} %{category} ketjut","latest":{"title":"Tuoreimmat","help":"ketjut, joissa on viimeaikaisia viestejä"},"hot":{"title":"Kuuma","help":"valikoima kuumimpia ketjuja"},"starred":{"title":"Tähdelliset","help":"tähdellä merkitsemäsi ketjut"},"read":{"title":"Luetut","help":"lukemasi ketjut, lukemisjärjestyksessä"},"categories":{"title":"Keskustelualueet","title_in":"Alue - {{categoryName}}","help":"kaikki ketjut alueen mukaan järjestettynä"},"unread":{"title":{"zero":"Lukemattomat","one":"Lukemattomat (1)","other":"Lukemattomat ({{count}})"},"help":"ketjut, joita seuraat tai tarkkailet tällä hetkellä ja joissa on lukemattomia viestejä","lower_title_with_count":{"one":"1 lukematon","other":"{{count}} lukematonta"}},"new":{"lower_title_with_count":{"one":"1 uusi","other":"{{count}} uutta"},"lower_title":"uusi","title":{"zero":"Uudet","one":"Uudet (1)","other":"Uudet ({{count}})"},"help":"viime päivinä luodut ketjut"},"posted":{"title":"Viestini","help":"ketjut, joihin olet kirjoittanut"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"Tuoreimmat alueella {{categoryName}}"},"top":{"title":"Huiput","help":"Aktiivisimmat ketjut viimeisen vuoden, kuukauden ja päivän ajalta","yearly":{"title":"Vuoden huiput"},"monthly":{"title":"Kuukauden huiput"},"weekly":{"title":"Viikon huiput"},"daily":{"title":"Päivän huiput"},"this_year":"Tänä vuonna","this_month":"Tässä kuussa","this_week":"Tällä viikolla","today":"Tänään","other_periods":"näytä lisää huippuketjuja"}},"browser_update":"Valitettavasti tätä sivustoa ei voi käyttää \u003ca href=\"http://www.discourse.org/faq/#browser\"\u003enäin vanhalla selaimella\u003c/a\u003e. Ole hyvä ja \u003ca href=\"http://browsehappy.com\"\u003epäivitä selaimesi\u003c/a\u003e.","permission_types":{"full":"Luoda / Vastata / Nähdä","create_post":"Vastata / Nähdä","readonly":"Nähdä"},"type_to_filter":"kirjoita suodattaaksesi...","admin":{"title":"Discourse ylläpitäjä","moderator":"Valvoja","dashboard":{"title":"Hallintapaneeli","last_updated":"Hallintapaneeli on päivitetty viimeksi:","version":"Versio","up_to_date":"Sivusto on ajan tasalla!","critical_available":"Kriittinen päivitys on saatavilla.","updates_available":"Päivityksiä on saatavilla.","please_upgrade":"Päivitä!","no_check_performed":"Päivityksiä ei ole tarkistettu. Varmista, että sidekiq on käynnissä.","stale_data":"Pävityksiä ei ole tarkistettu viime aikoina. Varmista, että sidekiq on käynnissä.","version_check_pending":"Näyttäisi, että olet päivittänyt lähiaikoina. Hienoa!","installed_version":"Asennettu","latest_version":"Viimeisin","problems_found":"Discourse asennuksesta on löytynyt ongelmia:","last_checked":"Viimeksi tarkistettu","refresh_problems":"Päivitä","no_problems":"Ongelmia ei löytynyt.","moderators":"Valvojat:","admins":"Ylläpitäjät:","blocked":"Estetyt:","suspended":"Hyllytetyt:","private_messages_short":"YV:t","private_messages_title":"Yksityisviestit","reports":{"today":"Tänään","yesterday":"Eilen","last_7_days":"Viimeisenä 7 päivänä","last_30_days":"Viimeisenä 30 päivänä","all_time":"Kaikilta ajoilta","7_days_ago":"7 päivää sitten","30_days_ago":"30 päivää sitten","all":"Kaikki","view_table":"Näytä taulukkona","view_chart":"Katsele pylväsdiagrammina"}},"commits":{"latest_changes":"Viimeisimmät muutokset: päivitä usein!","by":"käyttäjältä"},"flags":{"title":"Liput","old":"Vanha","active":"Aktiivinen","agree":"Ole samaa mieltä","agree_title":"Vahvista, että lippu on annettu oikeasta syystä","agree_flag_modal_title":"Ole samaa mieltä ja...","agree_flag_hide_post":"Samaa mieltä (piilota viesti ja lähetä YV)","agree_flag_hide_post_title":"Piilota tämä viesti automaattisesti ja lähetä käyttäjälle muokkaamaan hoputtava yksityisviesti","agree_flag":"Ole samaa mieltä lipun kanssa","agree_flag_title":"Ole samaa mieltä lipun kanssa ja älä muokkaa viestiä","defer_flag":"Lykkää","defer_flag_title":"Poista lippu; se ei vaadi toimenpiteitä tällä hetkellä.","delete":"Poista","delete_title":"Poista viesti, johon lippu viittaa.","delete_post_defer_flag":"Poista viesti ja lykkää lipun käsittelyä","delete_post_defer_flag_title":"Poista viesti; jos se on aloitusviesti, niin poista koko ketju","delete_post_agree_flag":"Poista viesti ja ole sama mieltä lipun kanssa","delete_post_agree_flag_title":"Poista viesti; jos se on aloitusviesti, niin poista koko ketju","delete_flag_modal_title":"Poista ja...","delete_spammer":"Poista roskapostittaja","delete_spammer_title":"Poista käyttäjä ja viestit ja ketjut tältä käyttäjältä.","disagree_flag_unhide_post":"Ole eri mieltä (poista viestin piilotus)","disagree_flag_unhide_post_title":"Poista kaikki liput tästä viestistä ja tee siitä taas näkyvä","disagree_flag":"Ole eri mieltä","disagree_flag_title":"Kiistä lippu, koska se on kelvoton tai väärä","clear_topic_flags":"Valmis","clear_topic_flags_title":"Tämä ketju on tutkittu ja sitä koskeneet ongelmat ratkaistu. Klikkaa Valmis poistaaksesi liput.","more":"(lisää vastauksia...)","dispositions":{"agreed":"olet samaa mieltä","disagreed":"olet eri mieltä","deferred":"lykätty"},"flagged_by":"Liputtajat","resolved_by":"Selvittäjä","took_action":"Ryhtyi toimenpiteisiin","system":"Järjestelmä","error":"Jotain meni pieleen","reply_message":"Vastaa","no_results":"Lippuja ei ole.","topic_flagged":"Tämä \u003cstrong\u003eketju\u003c/strong\u003e on liputettu.","visit_topic":"Vieraile ketjussa ryhtyäksesi toimiin","was_edited":"Viestiä muokattiin ensimmäisen lipun jälkeen","summary":{"action_type_3":{"one":"asiaankuulumaton","other":"asiaankuulumaton x{{count}}"},"action_type_4":{"one":"asiaton","other":"asiaton x{{count}}"},"action_type_6":{"one":"mukautettu","other":"mukautettu x{{count}}"},"action_type_7":{"one":"mukautettu","other":"mukautettu x{{count}}"},"action_type_8":{"one":"roskaposti","other":"roskapostia x {{count}}"}}},"groups":{"primary":"Ensisijainen ryhmä","no_primary":"(ei ensisijaista ryhmää)","title":"Ryhmät","edit":"Muokkaa ryhmiä","refresh":"Lataa uudelleen","new":"Uusi","selector_placeholder":"lisää käyttäjiä","name_placeholder":"Ryhmän nimi, ei välilyöntejä, samt säännöt kuin käyttäjänimillä","about":"Muokkaa ryhmien jäsenyyksiä ja nimiä täällä","group_members":"Ryhmään kuuluvat","delete":"Poista","delete_confirm":"Poista tämä ryhmä?","delete_failed":"Ryhmän poistaminen ei onnistu. Jos tämä on automaattinen ryhmä, sitä ei voi poistaa."},"api":{"generate_master":"Luo rajapinnan pääavain","none":"Aktiivisia API avaimia ei ole määritelty.","user":"Käyttäjä","title":"Rajapinta","key":"Rajapinnan avain","generate":"Luo","regenerate":"Tee uusi","revoke":"Peruuta","confirm_regen":"Oletko varma, että haluat korvata tämän API avaimen uudella?","confirm_revoke":"Oletko varma, että haluat peruuttaa tämän avaimen?","info_html":"API avaimen avulla voi luoda ja pävittää ketjuja käyttämällä JSON kutsuja.","all_users":"Kaikki käyttäjät","note_html":"Pidä tämä avain \u003cstrong\u003esalaisena\u003c/strong\u003e, sen haltija voi luoda viestejä esiintyen minä hyvänsä käyttäjänä."},"backups":{"title":"Varmuuskopiot","menu":{"backups":"Varmuuskopiot","logs":"Lokit"},"none":"Ei saatavilla olevia varmuuskopioita.","read_only":{"enable":{"title":"Käynnistä vain luku -tila.","text":"Käynnistä vain luku -tila.","confirm":"Oletko varma, että haluat käynnistää vain luku -tilan?"},"disable":{"title":"Poista vain luku -tila","text":"Poista vain luku -tila"}},"logs":{"none":"Lokeja ei ole vielä..."},"columns":{"filename":"Tiedostonimi","size":"Koko"},"upload":{"text":"LÄHETÄ","uploading":"LÄHETTÄÄ","success":"Tiedosto '{{filename}}' on lähetetty onnistuneesti.","error":"Tiedoston '{{filename}}' lähetyksen aikana tapahtui virhe: {{message}}"},"operations":{"is_running":"Operaatiota suoritetaan parhaillaan...","failed":"{{operation}} epäonnistui. Tarkista loki-tiedostot.","cancel":{"text":"Peruuta","title":"Peruuta toiminto","confirm":"Oletko varma, että haluat peruuttaa meneillään olevan toiminnon?"},"backup":{"text":"Varmuuskopioi","title":"Luo varmuuskopio","confirm":"Haluatko luoda uuden varmuuskopion?","without_uploads":"Kyllä (ilman latausta)"},"download":{"text":"Lataa","title":"Lataa varmuuskopio"},"destroy":{"text":"Poista","title":"Poista varmuuskopio","confirm":"Oletko varma, että haluat tuhota tämän varmuuskopion?"},"restore":{"is_disabled":"Palautus on estetty sivuston asetuksissa.","text":"Palauta","title":"Palauta varmuuskopio","confirm":"Oletko varma, että haluat palauttaa tämän varmuuskopion?"},"rollback":{"text":"Palauta","title":"Palauta tietokanta edelliseen toimivaan tilaan","confirm":"Oletko varma, että haluat palauttaa tietokannan edelliseen toimivaan tilaan?"}}},"export_csv":{"users":{"text":"Vie käyttäjätiedot","title":"Vie lista käyttäjistä CSV-tiedostoon."},"success":"Vienti on käynnissä, saat pian ilmoituksen sen edistymisestä.","failed":"Vienti epäonnistui. Tarkista loki-tiedostot."},"customize":{"title":"Mukauta","long_title":"Sivuston mukautukset","header":"Header","css":"Tyylitiedosto","mobile_header":"Mobiili header","mobile_css":"Mobiili tyylitiedosto","override_default":"Älä sisällytä oletus-tyylitiedostoa","enabled":"Otettu käyttöön?","preview":"esikatselu","undo_preview":"poista esikatselu","rescue_preview":"oletustyyli","explain_preview":"Esikatsele sivustoa käyttäen tätä tyylitiedostoa","explain_undo_preview":"Siirry takaisin nykyisin käytössä olevaan tyylitiedostoon","explain_rescue_preview":"Esikatsele sivustoa käyttäen oletustyylitiedostoa","save":"Tallenna","new":"Uusi","new_style":"Uusi tyyli","delete":"Poista","delete_confirm":"Poista tämä mukautus?","about":"Muokkaa sivuston CSS tyylitiedostoja ja HTML headeria. Lisää mukautus aloittaaksesi.","color":"Väri","opacity":"Läpinäkyvyys","copy":"Kopioi","css_html":{"title":"CSS/HTML","long_title":"CSS ja HTML Kustomoinnit"},"colors":{"title":"Värit","long_title":"Värimallit","about":"Muokkaa sivuston värejä kirjoittamatta CSS-koodia. Lisää värimallia aloittaaksesi.","new_name":"Uusi värimalli","copy_name_prefix":"Kopio","delete_confirm":"Poista tämä värimalli?","undo":"peru","undo_title":"Peru muutokset tähän väriin ja palauta edellinen tallennettu tila.","revert":"palauta","revert_title":"Palauta tämä väri Discourse värimallin oletusarvoihin","primary":{"name":"ensisijainen väri","description":"Useimmat tekstit, ikonit ja reunat."},"secondary":{"name":"toissijainen väri","description":"Pääasiallinen taustaväri ja joidenkin painikkeiden tekstin väri."},"tertiary":{"name":"kolmas väri","description":"Linkit, jotkin painikkeet, ilmoitukset ja tehosteväri."},"quaternary":{"name":"neljäs väri","description":"Navigaatiolinkit."},"header_background":{"name":"headerin tausta","description":"Sivuston headerin taustaväri."},"header_primary":{"name":"headerin ensisijainen","description":"Headerin teksti ja ikonit."},"highlight":{"name":"korostus","description":"Korostettujen elementtien, kuten viestien ja ketjujen, taustaväri."},"danger":{"name":"vaara","description":"Korosteväri toiminnoille, kun viestien ja ketjujen poistaminen."},"success":{"name":"menestys","description":"Käytetään ilmaisemaan, että toiminto onnistui."},"love":{"name":"tykkäys","description":"Tykkäyspainikkeen väri."}}},"email":{"title":"Sähköposti","settings":"Asetukset","all":"Kaikki","sending_test":"Lähetetään testisähköpostia...","test_error":"Testisähköpostin lähettäminen ei onnistunut. Tarkista uudelleen sähköpostiasetukset, varmista, että palveluntarjoajasi ei estä sähköpostiyhteyksiä ja kokeile sitten uudestaan.","sent":"Lähetetty","skipped":"Jätetty väliin","sent_at":"Lähetetty","time":"Aika","user":"Käyttäjä","email_type":"Sähköpostin tyyppi","to_address":"Osoitteeseen","test_email_address":"sähköpostiosoite kokelua varten","send_test":"Lähetä testisähköposti","sent_test":"lähetetty!","delivery_method":"Lähetystapa","preview_digest":"Esikatsele tiivistelmä","preview_digest_desc":"Tällä työkalulla voi esikatsella palstan lähettämien sähköpostitiivistelmien sisältöä.","refresh":"Päivitä","format":"Muotoilu","html":"html","text":"teksti","last_seen_user":"Käyttäjän edellinen kirjautuminen:","reply_key":"Vastausavain","skipped_reason":"Syy väliinjättämiselle","logs":{"none":"Lokeja ei löytynyt.","filters":{"title":"Suodatin","user_placeholder":"käyttäjätunnus","address_placeholder":"nimi@esimerkki.fi","type_placeholder":"tiivistelmä, kirjautuminen...","skipped_reason_placeholder":"syy"}}},"logs":{"title":"Lokit","action":"Toiminto","created_at":"Luotu","last_match_at":"Osunut viimeksi","match_count":"Osumat","ip_address":"IP-osoite","delete":"Poista","edit":"Muokkaa","save":"Tallenna","screened_actions":{"block":"estä","do_nothing":"älä tee mitään"},"staff_actions":{"title":"Henkilökunnan toimet","instructions":"Klikkaa käyttäjänimiä tai toimintoja suodattaaksesi listaa. Klikkaa avataria siirtyäksesi käyttäjäsivulle.","clear_filters":"Näytä kaikki","staff_user":"Palstan edustaja","target_user":"Kohteena ollut käyttäjä","subject":"Otsikko","when":"Milloin","context":"Konteksti","details":"Yksityiskohdat","previous_value":"Edellinen","new_value":"Uusi","diff":"Ero","show":"Näytä","modal_title":"Yksityiskohdat","no_previous":"Aiempaa arvoa ei ole.","deleted":"Uutta arvoa ei ole. Tietue poistettiin.","actions":{"delete_user":"poista käyttäjä","change_trust_level":"vaihda luottamustasoa","change_site_setting":"muuta sivuston asetusta","change_site_customization":"vaihda sivuston mukautusta","delete_site_customization":"poista sivuston mukautus","suspend_user":"hyllytä käyttäjä","unsuspend_user":"poista hyllytys","grant_badge":"myönnä arvomerkki","revoke_badge":"peru arvomerkki"}},"screened_emails":{"title":"Seulottavat sähköpostiosoitteet","description":"Uuden käyttäjätunnuksen luonnin yhteydessä annettua sähköpostiosoitetta verrataan alla olevaan listaan ja tarvittaessa tunnuksen luonti joko estetään tai suoritetaan muita toimenpiteitä.","email":"Sähköpostiosoite","actions":{"allow":"Salli"}},"screened_urls":{"title":"Seulottavat URL:t","description":"Tässä listattavat URL:t ovat olleet roskapostittajiksi tunnistettujen käyttäjien käytössä.","url":"URL-osoite","domain":"Verkkotunnus"},"screened_ips":{"title":"Seulottavat IP:t","description":"IP-osoitteet joita tarkkaillaan. Valitse \"Salli\" lisätäksesi osoitteen ohitettavien listalle.","delete_confirm":"Oletko varma, että haluat poistaa tämän säännön osoitteelle %{ip_address}?","actions":{"block":"Estä","do_nothing":"Salli"},"form":{"label":"Uusi:","ip_address":"IP-osoite","add":"Lisää"}},"logster":{"title":"Virhelokit"}},"impersonate":{"title":"Esiinny käyttäjänä","help":"Tällä työkalulla voi esiintyä toisena käyttäjänä virheiden paikantamista varten. Sinun täytyy kirjautua ulos, kun olet valmis."},"users":{"title":"Käyttäjät","create":"Lisää ylläpitäjä","last_emailed":"Viimeksi lähetetty sähköpostia","not_found":"Pahoittelut, tuota käyttäjänimeä ei löydy järjestelmästä.","active":"Aktiivinen","nav":{"new":"Uudet","active":"Aktiiviset","pending":"Odottaa","admins":"Ylläpitäjät","moderators":"Valvojat","suspended":"Hyllytetyt","blocked":"Estetyt"},"approved":"Hyväksytty?","approved_selected":{"one":"hyväksy käyttäjä","other":"hyväksy käyttäjiä ({{count}})"},"reject_selected":{"one":"torju käyttäjä","other":"torju ({{count}}) käyttäjää"},"titles":{"active":"Viimeksi aktiiviset käyttäjät","new":"Uudet käyttäjät","pending":"Hyväksymistä odottavat käyttäjät","newuser":"Luottamustason 0 käyttäjät (Uusi käyttäjä)","basic":"Luottamustason 1 käyttäjät (Peruskäyttäjä)","regular":"Luottamustason 2 käyttäjät (Tavallinen käyttäjä)","elder":"Luottamustason 4 käyttäjät (Vanhimmat)","admins":"Ylläpitäjät","moderators":"Valvojat","blocked":"Estetyt käyttäjät","suspended":"Hyllytetyt käyttäjät"},"reject_successful":{"one":"Yksi käyttäjä torjuttiin.","other":"({{count}}) käyttäjää torjuttiin."},"reject_failures":{"one":"Yhden käyttäjän torjuminen epäonnistui.","other":"({{count}}) käyttäjän torjuminen epäonnistui."},"not_verified":"Todentamaton"},"user":{"suspend_failed":"Jotain meni vikaan tätä käyttäjää hyllyttäessä: {{error}}","unsuspend_failed":"Jotain meni vikaan hyllytystä poistettaessa: {{error}}","suspend_duration":"Kuinka pitkäksi aikaa käyttäjä hyllytetään?","suspend_duration_units":"(päivää)","suspend_reason_label":"Miksi hyllytät käyttäjän? Tämä teksti \u003cb\u003eon näkyvillä julkisesti\u003c/b\u003e käyttäjän profiilisivulla ja näytetään käyttäjälle kun hän kirjautuu sisään. Pidä siis viesti lyhyenä.","suspend_reason":"Syy","suspended_by":"Käyttäjän hyllytti","delete_all_posts":"Poista kaikki viestit","delete_all_posts_confirm":"Olet poistamassa %{posts} viestiä ja %{topics} ketjua. Oletko varma? ","suspend":"Hyllytä","unsuspend":"Poista hyllytys","suspended":"Hyllytetty?","moderator":"Valvoja?","admin":"Ylläpitäjä?","blocked":"Estetty?","show_admin_profile":"Ylläpito","edit_title":"Muokkaa nimikettä","save_title":"Tallenna nimike","refresh_browsers":"Pakota sivun uudelleen lataus","refresh_browsers_message":"Viesti lähetetty kaikille asiakkaille!","show_public_profile":"Näytä julkinen profiili","impersonate":"Esiinny käyttäjänä","ip_lookup":"IP haku","log_out":"Kirjaudu ulos","logged_out":"Käyttäjä on kirjautunut ulos kaikilla laitteilla","revoke_admin":"Peru ylläpitäjän oikeudet","grant_admin":"Myönnä ylläpitäjän oikeudet","revoke_moderation":"Peru valvojan oikeudet","grant_moderation":"Myönnä valvojan oikeudet","unblock":"Poista esto","block":"Estä","reputation":"Maine","permissions":"Oikeudet","activity":"Toiminta","like_count":"Tykkäyksiä annettu / saatu","last_100_days":"edellisen 100 päivän aikana","private_topics_count":"Yksityisviestit","posts_read_count":"Luettuja viestejä","post_count":"Kirjoitettuja viestejä","topics_entered":"Katseltuja viestejä","flags_given_count":"Annettuja lippuja","flags_received_count":"Saatuja lippuja","flags_given_received_count":"Lippuja annettu / saatu","approve":"Hyväksy","approved_by":"hyväksyjä","approve_success":"Käyttäjä on hyväksytty ja hänelle on lähetetty sähköpostilla ohjeet tilin vahvistamiseen.","approve_bulk_success":"Kaikki valitut käyttäjät on hyväksytty ja heille on lähetetty ilmoitus.","time_read":"Lukuaika","delete":"Poista käyttäjä","delete_forbidden_because_staff":"Ylläpitäjiä ja valvojia ei voi poistaa.","delete_forbidden":{"one":"Käyttäjiä ei voi poistaa jos heillä on kirjoitettuja viestejä. Poista ensin viestit ennen käyttäjätilin poistamista. (Vanhempia viestejä, kuin %{count} päivä ei voi poistaa)","other":"Käyttäjiä ei voi poistaa jos heillä on kirjoitettuja viestejä. Poista ensin viestit ennen käyttäjätilin poistamista. (Vanhempia viestejä, kuin %{count} päivää ei voi poistaa)"},"cant_delete_all_posts":{"one":"Kaikkia viestejä ei voi poistaa. Jotkin viestit ovat enemmän kuin %{count} päivän vanhoja. (Asetus delete_user_max_post_age)","other":"Kaikkia viestejä ei voi poistaa. Jotkin viestit ovat enemmän kuin %{count} päivää vanhoja. (Asetus delete_user_max_post_age)"},"cant_delete_all_too_many_posts":{"one":"Kaikkia viestejä ei voi poistaa, koska käyttäjällä on enemmän kuin 1 viesti. (delete_all_posts_max)","other":"Kaikkia viestejä ei voi poistaa, koska käyttäjällä on enemmän kuin %{count} viestiä. (delete_all_posts_max)"},"delete_confirm":"Oletko VARMA, että haluat poistaa tämän käyttäjän? Toiminto on lopullinen!","delete_and_block":"Poista ja \u003cb\u003eestä\u003c/b\u003e tämä sähköposti ja IP-osoite.","delete_dont_block":"Ainoastaan poista","deleted":"Käyttäjä poistettiin.","delete_failed":"Käyttäjän poistanen ei onnistunut. Varmista, että kaikki käyttäjän viestit on poistettu.","send_activation_email":"Lähetä vahvistussähköposti.","activation_email_sent":"Vahvistussähköposti on lähetetty.","send_activation_email_failed":"Uuden vahvistussähköpostin lähettämisessä tapahtui virhe: %{error}","activate":"Vahvista käyttäjätili","activate_failed":"Käyttäjätilin vahvistaminen ei onnistunut.","deactivate_account":"Poista käyttäjätili käytöstä","deactivate_failed":"Käyttäjätilin poistaminen käytöstä ei onnistunut.","unblock_failed":"Käyttäjätilin eston poistaminen ei onnistunut.","block_failed":"Käyttäjätilin estäminen ei onnistunut.","deactivate_explanation":"Käytöstä poistetun käyttäjän täytyy uudelleen vahvistaa sähköpostiosoitteensa.","suspended_explanation":"Hyllytetty käyttäjä ei voi kirjautua sisään.","block_explanation":"Estetty käyttäjä ei voi luoda viestejä tai ketjuja.","trust_level_change_failed":"Käyttäjän luottamustason vaihtamisessa tapahtui virhe.","suspend_modal_title":"Hyllytä käyttäjä","trust_level_2_users":"Käyttäjät luottamustasolla 2","trust_level_3_requirements":"Luottamustaso 3 vaatimukset","tl3_requirements":{"title":"Vaatimukset luottamustasolle 3.","table_title":"Edellisen 100 päivän aikana:","value_heading":"Arvo","requirement_heading":"Vaatimus","visits":"Vierailua","days":"päivää","topics_replied_to":"Moneenko ketjuun vastannut","topics_viewed":"Avatut ketjut","topics_viewed_all_time":"Avatut ketjut (kaikkina aikoina)","posts_read":"Luetut viestit","posts_read_all_time":"Luetut viestit (kaikkina aikoina)","flagged_posts":"Liputettuja viestejä","flagged_by_users":"Liputtaneet käyttäjät","likes_given":"Annettuja tykkäyksiä","likes_received":"Saatuja tykkäyksiä","qualifies":"Täyttää luottamustaso 3:n vaatimukset.","will_be_promoted":"Ylennetään 24 tunnin sisällä.","does_not_qualify":"Ei täytä luottamustaso 3:n vaatimuksia."},"sso":{"title":"Kertakirjautuminen","external_id":"Ulkopuolinen ID","external_username":"Käyttäjätunnus","external_name":"Nimi","external_email":"Sähköposti","external_avatar_url":"Avatarin URL"}},"site_content":{"none":"Valitse sivuston osa aloittaaksesi muokkaamisen.","title":"Sisältö","edit":"Muokkaa sivuston osia"},"site_settings":{"show_overriden":"Näytä vain muokatut","title":"Asetukset","reset":"nollaa","none":"ei mitään","no_results":"Ei tuloksia.","clear_filter":"Tyhjennä","categories":{"all_results":"Kaikki","required":"Pakolliset","basic":"Perusasetukset","users":"Käyttäjät","posting":"Kirjoittaminen","email":"Sähköposti","files":"Tiedostot","trust":"Luottamustasot","security":"Turvallisuus","onebox":"Onebox","seo":"SEO","spam":"Roskaposti","rate_limits":"Rajat","developer":"Kehittäjä","embedding":"Upottaminen","legal":"Säännöt","uncategorized":"Muut","backups":"Varmuuskopiot","login":"Kirjautuminen"}},"badges":{"title":"Arvomerkit","new_badge":"Uusi arvomerkki","new":"Uusi","name":"Nimi","badge":"Arvomerkki","display_name":"Nimi","description":"Kuvaus","badge_type":"Arvomerkin tyyppi","badge_grouping":"Ryhmä","badge_groupings":{"modal_title":"Arvomerkkien ryhmitys"},"granted_by":"Myöntäjä","granted_at":"Myönnetty","save":"Tallenna","delete":"Poista","delete_confirm":"Oletko varma, että haluat poistaa tämän arvomerkin?","revoke":"Peruuta","revoke_confirm":"Oletko varma, että haluat peruuttaa arvomerkin?","edit_badges":"Muokkaa arvomerkkejä","grant_badge":"Myönnä arvomerkki","granted_badges":"Myönnetyt arvomerkit","grant":"Myönnä","no_user_badges":"%{name} ei ole saanut yhtään arvomerkkiä.","no_badges":"Myönnettäviä arvomerkkejä ei ole.","allow_title":"Salli arvomerkin käyttäminen tittelinä","multiple_grant":"Voidaan myöntää useita kertoja","listable":"Näytä arvomerkki julkisella arvomerkkisivulla","enabled":"Ota arvomerkki käyttöön","icon":"Ikoni","query":"Arvomerkkien haku tietokannasta (SQL)","target_posts":"Tietokantahaun kohdeviestit","auto_revoke":"Aja kumoamis-ajo päivittäin","show_posts":"Näytä arvomerkin tuonut viesti arvomerkkisivulla","trigger":"Laukaisija","trigger_type":{"none":"Päivitä päivittäin","post_action":"Kun käyttäjä toimii viestin suhteen","post_revision":"Kun käyttäjä muokkaa viestiä tai luo viestin","trust_level_change":"Kun käyttäjän luottamustaso vaihtuu","user_change":"Kun käyttäjä luodaan tai sitä muokataan"},"preview":{"link_text":"Esikatsele myönnettäviä arvomerkkejä","plan_text":"Esikatsele ","modal_title":"Arvomerkin tietokantakyselyn esikatselu","sql_error_header":"Kyselyn käsittelyssä tapahtui virhe.","error_help":"Apua arvomerkkien tietokantakyselyihin saat seuraavista linkeistä-","bad_count_warning":{"header":"VAROITUS!"},"grant_count":{"zero":"Ei arvomerkkejä myönnettävänä.","one":"\u003cb\u003e1\u003c/b\u003e arvomerkki myönnettävänä.","other":"\u003cb\u003e%{count}\u003c/b\u003e arvomerkkiä myönnettävänä."},"sample":"Esimerkki:","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e viestille ketjussa %{link}","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e viestille ketjussa %{link} \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}}},"lightbox":{"download":"lataa"},"keyboard_shortcuts_help":{"title":"Näppäinoikotiet","jump_to":{"title":"Siirry","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e Koti (Tuoreimmat)","latest":"\u003cb\u003eg\u003c/b\u003e,\u003cb\u003el\u003c/b\u003e Tuoreimmat","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e Uudet","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e Lukemattomat","starred":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ef\u003c/b\u003e Tähdelliset","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Alueet"},"navigation":{"title":"Navigointi","jump":"\u003cb\u003e#\u003c/b\u003e Siirry viestiin numeron perusteella","back":"\u003cb\u003eu\u003c/b\u003e Takaisin","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Siirrä valintaa ylös/alas","open":"\u003cb\u003eo\u003c/b\u003e tai \u003cb\u003eEnter\u003c/b\u003e Avaa valittu ketju","next_prev":"\u003cb\u003eshift j\u003c/b\u003e/\u003cb\u003eshift k\u003c/b\u003e Seuraava/edellinen osio"},"application":{"title":"Ohjelmisto","create":"\u003cb\u003ec\u003c/b\u003e Luo uusi ketju","notifications":"\u003cb\u003en\u003c/b\u003e Avaa ilmoitukset","site_map_menu":"\u003cb\u003e=\u003c/b\u003e Avaa palstan valikko","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e Avaa käyttäjätilin valikko","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e Näytä tulevat/päivittyneet ketjut","search":"\u003cb\u003e/\u003c/b\u003e Etsi","help":"\u003cb\u003e?\u003c/b\u003e Avaa näppäinoikoteiden apu","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Unohda uudet/viestit","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Unohda ketjut"},"actions":{"title":"Toiminnot","star":"\u003cb\u003ef\u003c/b\u003e Merkitse ketju tähdellä","share_topic":"\u003cb\u003eshift s\u003c/b\u003e Jaa ketju","share_post":"\u003cb\u003es\u003c/b\u003e Jaa viesti","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e Vastaa uudessa ketjussa","reply_topic":"\u003cb\u003eshift r\u003c/b\u003e Vastaa ketjuun","reply_post":"\u003cb\u003er\u003c/b\u003e Vastaa viestiin","quote_post":"\u003cb\u003eq\u003c/b\u003e Lainaa viesti","like":"\u003cb\u003el\u003c/b\u003e Tykkää viestistä","flag":"\u003cb\u003e!\u003c/b\u003e Liputa viesti","bookmark":"\u003cb\u003eb\u003c/b\u003e Lisää viesti kirjanmerkkeihin","edit":"\u003cb\u003ee\u003c/b\u003e Muokkaa viestiä","delete":"\u003cb\u003ed\u003c/b\u003e Poista viesti","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Vaimenna ketju","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Tavallinen (oletus) ketju","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Seuraa ketjua","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e Tarkkaile ketjua"}},"badges":{"title":"Arvomerkit","allow_title":"salli arvomerkin käyttäminen tittelinä?","multiple_grant":"myönnettävissä useita kertoja?","badge_count":{"one":"1 Arvomerkki","other":"%{count} Arvomerkkiä"},"more_badges":{"one":"+1 Lisää","other":"+%{count} Lisää"},"granted":{"one":"1 myönnetty","other":"%{count} myönnettyä"},"select_badge_for_title":"Valitse tittelisi arvomerkeistä","no_title":"\u003cei otsikkoa\u003e","badge_grouping":{"getting_started":{"name":"Ensiaskeleet"},"community":{"name":"Yhteisö"},"trust_level":{"name":"Luottamustaso"},"other":{"name":"Muut"},"posting":{"name":"Kirjoittaminen"}},"badge":{"editor":{"name":"Muokkaaja","description":"Ensimmäinen muokkaus"},"basic_user":{"name":"Peruskäyttäjä","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/4\"\u003eMyönnetty\u003c/a\u003e oikeudet tärkeimpiin toimintoihin"},"regular_user":{"name":"Tavallinen käyttäjä","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/5\"\u003eMyönnetty\u003c/a\u003e oikeus kutsua käyttäjiä"},"leader":{"name":"Johtaja","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/6\"\u003eMyönnetty\u003c/a\u003e oikeus siirtää ja nimetä uudelleen ketjuja, linkkien seuraaminen ja Lounge"},"elder":{"name":"Vanhin","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/7\"\u003eMyönnetty\u003c/a\u003e ketjujen globaali muokkaus, kiinnitys, sulkeminen, arkistointi, jakaminen ja yhdistäminen"},"welcome":{"name":"Tervetuloa","description":"Sai tykkäyksen"},"autobiographer":{"name":"Muistelmien kirjoittaja","description":"Täytti \u003ca href=\"/my/preferences\"\u003ekäyttäjätiedot\u003c/a\u003e"},"nice_post":{"name":"Kiva viesti","description":"Sai 10 tykkäystä viestistä. Tämä arvomerkki voidaan myöntää useita kertoja"},"good_post":{"name":"Hyvä viesti","description":"Sai 25 tykkäystä viestistä. Tämä arvomerkki voidaan myöntää useita kertoja"},"great_post":{"name":"Mahtava viesti","description":"Sai 50 tykkäystä viestistä. Tämä arvomerkki voidaan myöntää useita kertoja"},"first_like":{"name":"Ensimmäinen tykkäys","description":"Tykkäsi viestistä"},"first_flag":{"name":"Ensimmäinen liputus","description":"Liputti viestin"},"first_share":{"name":"Ensimmäinen jakaminen","description":"Jakoi viestin"},"first_link":{"name":"Ensimmäinen linkki","description":"Lisäsi viestiin linkin toiseen ketjuun"},"first_quote":{"name":"Ensimmäinen lainaus","description":"Lainasi toista käyttäjää"},"read_guidelines":{"name":"Luki ohjeet","description":"Luki sivuston \u003ca href=\"/guidelines\"\u003eohjeet\u003c/a\u003e"},"reader":{"name":"Lukija","description":"Luki kaikki viestit ketjusta, jossa on yli 100 viestiä"}}}}}};
I18n.locale = 'fi';
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
// locale : finnish (fi)
// author : Tarmo Aidantausta : https://github.com/bleadof

(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define(['moment'], factory); // AMD
    } else if (typeof exports === 'object') {
        module.exports = factory(require('../moment')); // Node
    } else {
        factory(window.moment); // Browser global
    }
}(function (moment) {
    var numbersPast = 'nolla yksi kaksi kolme neljä viisi kuusi seitsemän kahdeksan yhdeksän'.split(' '),
        numbersFuture = [
            'nolla', 'yhden', 'kahden', 'kolmen', 'neljän', 'viiden', 'kuuden',
            numbersPast[7], numbersPast[8], numbersPast[9]
        ];

    function translate(number, withoutSuffix, key, isFuture) {
        var result = "";
        switch (key) {
        case 's':
            return isFuture ? 'muutaman sekunnin' : 'muutama sekunti';
        case 'm':
            return isFuture ? 'minuutin' : 'minuutti';
        case 'mm':
            result = isFuture ? 'minuutin' : 'minuuttia';
            break;
        case 'h':
            return isFuture ? 'tunnin' : 'tunti';
        case 'hh':
            result = isFuture ? 'tunnin' : 'tuntia';
            break;
        case 'd':
            return isFuture ? 'päivän' : 'päivä';
        case 'dd':
            result = isFuture ? 'päivän' : 'päivää';
            break;
        case 'M':
            return isFuture ? 'kuukauden' : 'kuukausi';
        case 'MM':
            result = isFuture ? 'kuukauden' : 'kuukautta';
            break;
        case 'y':
            return isFuture ? 'vuoden' : 'vuosi';
        case 'yy':
            result = isFuture ? 'vuoden' : 'vuotta';
            break;
        }
        result = verbalNumber(number, isFuture) + " " + result;
        return result;
    }

    function verbalNumber(number, isFuture) {
        return number < 10 ? (isFuture ? numbersFuture[number] : numbersPast[number]) : number;
    }

    return moment.defineLocale('fi', {
        months : "tammikuu_helmikuu_maaliskuu_huhtikuu_toukokuu_kesäkuu_heinäkuu_elokuu_syyskuu_lokakuu_marraskuu_joulukuu".split("_"),
        monthsShort : "tammi_helmi_maalis_huhti_touko_kesä_heinä_elo_syys_loka_marras_joulu".split("_"),
        weekdays : "sunnuntai_maanantai_tiistai_keskiviikko_torstai_perjantai_lauantai".split("_"),
        weekdaysShort : "su_ma_ti_ke_to_pe_la".split("_"),
        weekdaysMin : "su_ma_ti_ke_to_pe_la".split("_"),
        longDateFormat : {
            LT : "HH.mm",
            L : "DD.MM.YYYY",
            LL : "Do MMMM[ta] YYYY",
            LLL : "Do MMMM[ta] YYYY, [klo] LT",
            LLLL : "dddd, Do MMMM[ta] YYYY, [klo] LT",
            l : "D.M.YYYY",
            ll : "Do MMM YYYY",
            lll : "Do MMM YYYY, [klo] LT",
            llll : "ddd, Do MMM YYYY, [klo] LT"
        },
        calendar : {
            sameDay : '[tänään] [klo] LT',
            nextDay : '[huomenna] [klo] LT',
            nextWeek : 'dddd [klo] LT',
            lastDay : '[eilen] [klo] LT',
            lastWeek : '[viime] dddd[na] [klo] LT',
            sameElse : 'L'
        },
        relativeTime : {
            future : "%s päästä",
            past : "%s sitten",
            s : translate,
            m : translate,
            mm : translate,
            h : translate,
            hh : translate,
            d : translate,
            dd : translate,
            M : translate,
            MM : translate,
            y : translate,
            yy : translate
        },
        ordinal : "%d.",
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });
}));

moment.fn.shortDateNoYear = function(){ return this.format('D. MMM'); };
moment.fn.shortDate = function(){ return this.format('D. MMMM[ta] YYYY'); };
moment.fn.longDate = function(){ return this.format('D. MMMM[ta] YYYY, H:mm'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
