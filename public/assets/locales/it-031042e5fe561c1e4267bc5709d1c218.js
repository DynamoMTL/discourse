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
MessageFormat.locale.it = function ( n ) {
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
r += "C'è <a href='/unread'>1 argomento non letto</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "Ci sono <a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " argomenti non letti</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["it"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " \n";
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
r += "e ";
return r;
},
"false" : function(d){
var r = "";
r += "è ";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='/new'>1 nuovo</a> argomento";
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
r += "e ";
return r;
},
"false" : function(d){
var r = "";
r += "sono ";
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
})() + " nuovi</a> argomenti";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["it"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " \nrestanti, o ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "visualizza altri argomenti in ";
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
r += "Questo argomento ha ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 messaggio";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " messaggi";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["it"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "con un alto rapporto \"mi piace\" / messaggi";
return r;
},
"med" : function(d){
var r = "";
r += "con un altissimo rapporto \"mi piace\" / messaggi";
return r;
},
"high" : function(d){
var r = "";
r += "con un estremamente alto rapporto \"mi piace\" / messaggi";
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
}});I18n.translations = {"it":{"js":{"number":{"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Byte"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}}},"dates":{"time":"h:mm a","long_no_year":"D MMM h:mm a","long_no_year_no_time":"D MMM","long_with_year":"D MMM YYYY h:mm a","long_with_year_no_time":"D MMM YYYY","long_date_with_year":"D MMM 'YY LT","long_date_without_year":"D MMM LT","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c 1s","other":"\u003c %{count}s"},"x_seconds":{"one":"1s","other":"%{count}s"},"less_than_x_minutes":{"one":"\u003c 1m","other":"\u003c %{count}m"},"x_minutes":{"one":"1m","other":"%{count}m"},"about_x_hours":{"one":"1h","other":"%{count}h"},"x_days":{"one":"1g","other":"%{count}gg"},"about_x_years":{"one":"1a","other":"%{count}a"},"over_x_years":{"one":"\u003e 1a","other":"\u003e %{count}a"},"almost_x_years":{"one":"1a","other":"%{count}a"},"date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"1 min.","other":"%{count} min."},"x_hours":{"one":"1 ora","other":"%{count} ore"},"x_days":{"one":"1 giorno","other":"%{count} giorni"}},"medium_with_ago":{"x_minutes":{"one":"1 minuto fa","other":"%{count} minuti fa"},"x_hours":{"one":"1 ora fa","other":"%{count} ore fa"},"x_days":{"one":"un giorno fa","other":"%{count} giorni fa"}}},"share":{"topic":"Condividi un link a questa conversazione","post":"Condividi un link al post #%{postNumber}","close":"chiudi","twitter":"Condividi questo link su Twitter","facebook":"Condividi questo link su Facebook","google+":"Condividi questo link su Google+","email":"Invia questo link via email"},"edit":"modifica titolo e categoria del topic","not_implemented":"Spiacenti! Questa funzione non è stata ancora implementata.","no_value":"No","yes_value":"Sì","generic_error":"Spiacenti! C'è stato un problema.","generic_error_with_reason":"Si è verificato un errore: %{error}","sign_up":"Registrati","log_in":"Accedi","age":"Età","joined":"Iscritto","admin_title":"Amministrazione","flags_title":"Segnalazioni","show_more":"Altro","links":"Link","links_lowercase":"collegamenti","faq":"FAQ","guidelines":"Linee Guida","privacy_policy":"Tutela Privacy","privacy":"Privacy","terms_of_service":"Termini di Servizio","mobile_view":"Visualizzazione Mobile","desktop_view":"Visualizzazione Desktop","you":"Tu","or":"oppure","now":"ora","read_more":"continua","more":"Più","less":"Meno","never":"mai","daily":"giornaliero","weekly":"settimanale","every_two_weeks":"ogni due settimane","max":"massimo","character_count":{"one":"{{count}} carattere","other":"{{count}} caratteri"},"in_n_seconds":{"one":"tra 1 secondo","other":"tra {{count}} secondi"},"in_n_minutes":{"one":"tra 1 minuto","other":"tra {{count}} minuti"},"in_n_hours":{"one":"tra un'ora","other":"tra {{count}} ore"},"in_n_days":{"one":"tra 1 giorno","other":"tra {{count}} giorni"},"suggested_topics":{"title":"Discussioni Suggerite"},"about":{"simple_title":"Informazioni","title":"Informazioni su %{title}","stats":"Statistiche del Sito","our_admins":"I Nostri Amministratori","our_moderators":"I Nostri Moderatori","stat":{"all_time":"Sempre","last_7_days":"Ultimi 7 giorni"},"like_count":"Conteggio Mi Piace","topic_count":"Conteggio Argomenti","post_count":"Conteggio Messaggi","user_count":"Conteggio Utenti"},"bookmarks":{"not_logged_in":"spiacenti, devi essere connesso per aggiungere segnalibri ai messaggi","created":"hai inserito questo messaggio nei segnalibri.","not_bookmarked":"hai letto questo messaggio; clicca per inserirlo nei segnalibri","last_read":"questo è l'ultimo messaggio che hai letto; clicca per inserirlo nei segnalibri","remove":"Rimuovi Segnalibro"},"topic_count_latest":{"one":"{{count}} discussione nuova o aggiornata","other":"{{count}} argomenti nuovi o aggiornati."},"topic_count_unread":{"one":"{{count}} discussione non letta.","other":"{{count}} argomenti non letti."},"topic_count_new":{"one":"{{count}} nuovo argomento.","other":"{{count}} nuovi argomenti."},"click_to_show":"Clicca per visualizzare.","preview":"Anteprima","cancel":"annulla","save":"Salva modifiche","saving":"Salvataggio...","saved":"Salvato!","upload":"Carica","uploading":"In caricamento...","uploaded":"Caricato!","enable":"Attiva","disable":"Disattiva","undo":"Annulla","revert":"Ripristina","banner":{"close":"Nascondi questo banner."},"choose_topic":{"none_found":"Nessun topic trovato.","title":{"search":"Cerca conversazioni per nome, indirizzo o numero:","placeholder":"digita il titolo della conversazione"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e ha pubblicato questo \u003ca href='{{topicUrl}}'\u003etopic\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eTu\u003c/a\u003e hai pubblicato questo \u003ca href='{{topicUrl}}'\u003etopic\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e ha risposto a \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eTu\u003c/a\u003e hai risposto a \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e ha risposto a questo \u003ca href='{{topicUrl}}'\u003etopic\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eYou\u003c/a\u003e hai risposto a questo \u003ca href='{{topicUrl}}'\u003etopic\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003eTu\u003c/a\u003e hai menzionato \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003eTu\u003c/a\u003e hai menzionato \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eTu\u003c/a\u003e hai menzionato \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Pubblicato da \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Pubblicato da \u003ca href='{{userUrl}}'\u003ete\u003c/a\u003e","sent_by_user":"Inviato da \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Inviato da \u003ca href='{{userUrl}}'\u003ete\u003c/a\u003e"},"groups":{"visible":"Il Gruppo è visibile a tutti gli utenti","title":{"one":"gruppo","other":"gruppi"},"members":"Membri","posts":"Messaggi","alias_levels":{"title":"Chi può usare questo gruppo come alias?","nobody":"Nessuno","only_admins":"Solo gli amministratori","mods_and_admins":"Solo i moderatori e gli amministratori","members_mods_and_admins":"Solo i membri del gruppo, i moderatori e gli amministratori","everyone":"Tutti"}},"user_action_groups":{"1":"Mi piace - Assegnati","2":"Mi piace - Ricevuti","3":"Segnalibri","4":"Topic","5":"Post","6":"Risposte","7":"Menzioni","9":"Citazioni","10":"Preferiti","11":"Modifiche","12":"Inviati","13":"Posta in arrivo"},"categories":{"all":"tutte le categorie","all_subcategories":"tutte","no_subcategory":"nessuno","category":"Categoria","posts":"Messaggi","topics":"Argomenti","latest":"Più recenti","latest_by":"i più recenti di","toggle_ordering":"inverti l'ordinamento","subcategories":"Sottocategorie","topic_stats":"Numero di nuovi argomenti.","topic_stat_sentence":{"one":"%{count} nuovo argomento nell'ultimo %{unit}.","other":"%{count} nuovi argomenti nell'ultimo %{unit}."},"post_stats":"Numero di nuovi messaggi.","post_stat_sentence":{"one":"%{count} nuovo messaggio nell'ultimo %{unit}.","other":"%{count} nuovi messaggi nell'ultimo %{unit}."}},"ip_lookup":{"title":"Ricerca Indirizzo IP","hostname":"Hostname","location":"Località","location_not_found":"(sconosciuto)","organisation":"Organizzazione","phone":"Telefono","other_accounts":"Altri account con questo indirizzo IP","no_other_accounts":"(nessuno)"},"user":{"said":"{{username}} ha scritto:","profile":"Profilo","mute":"Ignora","edit":"Modifica opzioni","download_archive":"scarica lo storico dei miei post","private_message":"Messaggio privato","private_messages":"Messaggi","activity_stream":"Attività","preferences":"Opzioni","bookmarks":"Segnalibri","bio":"Su di me","invited_by":"Invitato Da","trust_level":"Livello Attendibilità","notifications":"Notifiche","disable_jump_reply":"Non saltare al nuovo messaggio dopo la risposta","dynamic_favicon":"Mostra la notifica dei messaggi in arrivo nella favicon (funzione sperimentale)","edit_history_public":"Consenti agli altri utenti di visualizzare le mie revisioni ai messaggi","external_links_in_new_tab":"Apri tutti i link esterni in nuove schede","enable_quoting":"Abilita \"rispondi quotando\" per il testo evidenziato","change":"cambia","moderator":"{{user}} è un moderatore","admin":"{{user}} è un amministratore","moderator_tooltip":"Questo utente è un moderatore","admin_tooltip":"Questo utente è un amministratore","suspended_notice":"Questo utente è sospeso fino al {{date}}.","suspended_reason":"Motivo: ","watched_categories":"Osservata/e","watched_categories_instructions":"Seguirai automaticamente tutti i nuovi argomenti in queste categorie. Riceverai notifiche su tutti i nuovi messaggi e argomenti. Inoltre, accanto all'elenco degli argomenti apparirà il conteggio dei messaggi non letti e di quelli nuovi.","tracked_categories":"Seguita/e","tracked_categories_instructions":"Seguirai automaticamente tutti i nuovi argomenti in queste categorie. Il conteggio dei messaggi nuovi e non letti comparirà di fianco all'elenco degli argomenti.","muted_categories":"Ignorato","muted_categories_instructions":"Non ti verrà notificato nulla sui nuovi argomenti in queste categorie, e non compariranno nel tab dei non letti.","delete_account":"Cancella il mio account","delete_account_confirm":"Sei sicuro di voler cancellare il tuo account in modo permanente? Questa azione non può essere annullata!","deleted_yourself":"Il tuo account è stato eliminato con successo.","delete_yourself_not_allowed":"Non puoi eliminare il tuo account in questo momento. Contatta un amministratore e chiedigli di cancellarlo per te.","unread_message_count":"Messaggi","staff_counters":{"flags_given":"segnalazioni utili inviate","flagged_posts":"messaggi segnalati","deleted_posts":"messaggi cancellati","suspensions":"sospensioni"},"messages":{"all":"Tutti","mine":"Miei","unread":"Non letti"},"change_password":{"success":"(email inviata)","in_progress":"(invio email in corso)","error":"(errore)","action":"Invia l'email per il ripristino della password","set_password":"Imposta Password"},"change_about":{"title":"Modifica i dati personali"},"change_username":{"title":"Cambia Utente","confirm":"Se modifichi il tuo nome utente, non funzioneranno più le precedenti citazioni ai tuoi messaggi e le menzioni @nome. Sei sicuro di volerlo fare?","taken":"Spiacenti, questo nome utente è già riservato.","error":"C'è stato un problema nel cambio del tuo nome utente.","invalid":"Nome utente non valido: usa solo lettere e cifre"},"change_email":{"title":"Cambia email","taken":"Spiacenti, questa email non è disponibile.","error":"C'è stato un errore nel cambio dell'email; potrebbe essere già usata da un altro utente.","success":"Abbiamo inviato una email a questo indirizzo. Segui le indicazioni di conferma."},"change_avatar":{"title":"Cambia il tuo avatar","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, basato su","refresh_gravatar_title":"Ricarica il tuo Gravatar","letter_based":"Avatar assegnato dal sistema","uploaded_avatar":"Immagine personalizzata","uploaded_avatar_empty":"Aggiungi un'immagine personalizzata","upload_title":"Carica la tua foto","upload_picture":"Carica Immagine","image_is_not_a_square":"Attenzione: abbiamo ritagliato la tua immagine; non è quadrata."},"change_profile_background":{"title":"Sfondo Profilo"},"email":{"title":"Email","instructions":"Non verrà mai mostrato al pubblico.","ok":"Tutto a posto! Ti manderemo una email di conferma.","invalid":"Inserisci un indirizzo email valido.","authenticated":"{{provider}} ha autenticato la tua email.","frequency":"Ti invieremo mail solo se è un po' che non ti si vede; le email riguarderanno solo le conversazioni che non hai letto."},"name":{"title":"Nome","instructions":"Versione completa del tuo nome.","too_short":"Il nome è troppo breve.","ok":"Il nome è adeguato."},"username":{"title":"Nome utente","instructions":"Deve essere unico, senza spazi e breve.","short_instructions":"Gli utenti possono citarti scrivendo \"@{{username}}\".","available":"Il nome utente è disponibile.","global_match":"L'email corrisponde allo nome utente registrato.","global_mismatch":"Già registrato. Prova {{suggestion}}?","not_available":"Non disponibile. Prova {{suggestion}}?","too_short":"Il nome utente è troppo breve.","too_long":"Il nome utente è troppo lungo.","checking":"Controllo la disponibilità del nome utente...","enter_email":"Nome utente trovato. Inserisci l'email corrispondente.","prefilled":"L'email corrisponde allo username registrato."},"locale":{"title":"Lingua dell'interfaccia","default":"(default)"},"password_confirmation":{"title":"Ripeti la password"},"last_posted":"Ultimo Messaggio","last_emailed":"Ultima email inviata","last_seen":"Ultima visita","created":"Membro da","log_out":"Esci","location":"Località","website":"Sito Web","email_settings":"Email","email_digests":{"title":"Quando non visiti il sito, invia un riassunto delle novità:","daily":"ogni giorno","weekly":"ogni settimana","bi_weekly":"ogni due settimane"},"email_direct":"Ricevi un'email quando qualcuno ti cita, risponde ad un tuo messaggio, o menziona il tuo @nome","email_private_messages":"Ricevi un'email quando qualcuno ti invia un messaggio privato ","other_settings":"Altro","categories_settings":"Categorie","new_topic_duration":{"label":"Considera un argomento \"nuovo\" se","not_viewed":"non li hai ancora letti","last_here":"creati dalla tua ultima visita","after_n_days":{"one":"creato nell'ultimo giorno","other":"creato negli ultimi {{count}} giorni"},"after_n_weeks":{"one":"creato nell'ultima settimana","other":"creato nelle ultime {{count}} settimane"}},"auto_track_topics":"Tieni traccia degli argomenti inseriti da te","auto_track_options":{"never":"mai","always":"sempre","after_n_seconds":{"one":"per un minuto","other":"dopo {{count}} secondi"},"after_n_minutes":{"one":"per 1 minuto","other":"dopo {{count}} minuti"}},"invited":{"search":"digita per cercare inviti...","title":"Inviti","user":"Utente Invitato","none":"Non hai ancora invitato nessuno qui.","truncated":"Mostro i primi {{count}} inviti.","redeemed":"Inviti Accettati","redeemed_at":"Accettato","pending":"Inviti in sospeso","topics_entered":"Argomenti Letti","posts_read_count":"Messaggi Letti","expired":"L'invito è scaduto.","rescind":"Rimuovi","rescinded":"Invito revocato","time_read":"Ora di Lettura","days_visited":"Presenza (giorni)","account_age_days":"Età dell'utente in giorni","create":"Invia un Invito","bulk_invite":{"none":"Non hai ancora invitato nessuno qui. Puoi inviare inviti individuali, o invitare un gruppo di persone caricando un \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003efile di invito di massa\u003c/a\u003e.","text":"Invito di Massa da File","uploading":"CARICAMENTO","success":"Il file è stato caricato correttamente, verrai notificato a breve con i progressi.","error":"Si è verificato un errore durante il caricamento {{filename}}': {{message}}"}},"password":{"title":"Password","too_short":"La password è troppo breve.","common":"Questa password è troppo comune.","ok":"La password è adeguata","instructions":"Deve essere almeno di %{count} caratteri."},"ip_address":{"title":"Ultimo indirizzo IP"},"registration_ip_address":{"title":"Indirizzo IP di Registrazione"},"avatar":{"title":"Avatar"},"title":{"title":"Titolo"},"filters":{"all":"Tutti"},"stream":{"posted_by":"Pubblicato da","sent_by":"Inviato da","private_message":"messaggio privato","the_topic":"l'argomento"}},"loading":" Caricamento...","errors":{"prev_page":"durante il caricamento","reasons":{"network":"Errore di Rete","server":"Errore del Server","forbidden":"Accesso Negato","unknown":"Errore"},"desc":{"network":"Per favore controlla la connessione.","network_fixed":"Sembra essere tornato.","server":"Codice di errore: {{status}}","unknown":"Qualcosa è andato storto."},"buttons":{"back":"Torna Indietro","again":"Riprova","fixed":"Carica Pagina"}},"close":"Chiudi","assets_changed_confirm":"Questo sito è stato aggiornato. Aggiornare ora alla nuova versione?","read_only_mode":{"enabled":"Un amministratore ha attivato la modalità di sola lettura. Puoi continuare a navigare nel sito ma le interazioni potrebbero non funzionare.","login_disabled":"L'accesso è disabilitato quando il sito è in modalità di sola lettura."},"learn_more":"per saperne di più...","year":"all'anno","year_desc":"argomenti creati negli ultimi 365 giorni","month":"al mese","month_desc":"argomenti creati negli ultimi 30 giorni","week":"a settimana","week_desc":"argomenti creati negli ultimi 7 giorni","day":"al giorno","first_post":"Primo messaggio","mute":"Ignora","unmute":"Attiva","last_post":"Ultimo messaggio","last_post_lowercase":"ultimo messaggio","summary":{"description":"Ci sono \u003cb\u003e{{count}}\u003c/b\u003e risposte.","description_time":"Ci sono \u003cb\u003e{{count}}\u003c/b\u003e risposte con un tempo stimato di lettura di  \u003cb\u003e{{readingTime}} minuti\u003c/b\u003e.","enable":"Riassumi Questo Argomento","disable":"Mostra Tutti i Messaggi"},"deleted_filter":{"enabled_description":"Questo argomento contiene messaggi eliminati, che sono quindi nascosti.","disabled_description":"I messaggi eliminati di questo argomento sono ora visibili.","enable":"Nascondi Messaggi Eliminati","disable":"Mostra Messaggi Eliminati"},"private_message_info":{"title":"Messaggio Privato","invite":"Invita altri utenti...","remove_allowed_user":"Davvero vuoi rimuovere {{name}} da questo messaggio privato?"},"email":"Email","username":"Nome utente","last_seen":"Ultima visita","created":"Creato","created_lowercase":"creato","trust_level":"Livello Attendibilità","search_hint":"username o email","create_account":{"title":"Crea Nuovo Account","failed":"Qualcosa non ha funzionato. Forse questa email è già registrata, prova a usare il link di recupero password"},"forgot_password":{"title":"Password Dimenticata","action":"Ho dimenticato la password","invite":"Inserisci il nome utente o l'indirizzo email. Ti manderemo un'email per l'azzeramento della password.","reset":"Azzera Password","complete_username":"Se un account corrisponde al nome utente \u003cb\u003e%{username}\u003c/b\u003e, a breve dovresti ricevere un'email con le istruzioni per ripristinare la tua password.","complete_email":"Se un account corrisponde a \u003cb\u003e%{email}\u003c/b\u003e,  a breve dovresti ricevere un'email contenente le istruzioni per ripristinare la password."},"login":{"title":"Accedi","username":"Utente","password":"Password","email_placeholder":"email o nome utente","caps_lock_warning":"Il Blocco Maiuscole è attivo","error":"Errore sconosciuto","blank_username_or_password":"Per favore inserisci la tua email o il tuo nome utente, e la password.","reset_password":"Azzera Password","logging_in":"Connessione in corso...","or":"Oppure","authenticating":"Autenticazione...","awaiting_confirmation":"Il tuo account è in attesa di attivazione, usa il collegamento \"password dimenticata\" per ricevere una nuova email di attivazione.","awaiting_approval":"Il tuo account non è stato ancora approvato da un membro dello staff. Ti invieremo un'email non appena verrà approvato.","requires_invite":"Spiacenti, l'accesso a questo forum e solo ad invito.","not_activated":"Non puoi ancora effettuare l'accesso. Abbiamo inviato un'email di attivazione a \u003cb\u003e{{sentTo}}\u003c/b\u003e. Per favore segui le istruzioni contenute nell'email per attivare l'account.","resend_activation_email":"Clicca qui per inviare nuovamente l'email di attivazione.","sent_activation_email_again":"Ti abbiamo mandato un'altra email di attivazione su \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Potrebbero essere necessari alcuni minuti di attesa; assicurati di controllare anche la cartella dello spam.","google":{"title":"con Google","message":"Autenticazione tramite Google (assicurati che il blocco pop up non sia attivo)"},"google_oauth2":{"title":"con Google","message":"Autenticazione tramite Google (assicurati che il blocco pop up non siano attivo)"},"twitter":{"title":"con Twitter","message":"Autenticazione con Twitter (assicurati che il blocco pop up non sia attivo)"},"facebook":{"title":"con Facebook","message":"Autenticazione con Facebook (assicurati che il blocco pop up non sia attivo)"},"yahoo":{"title":"con Yahoo","message":"Autenticazione con Yahoo (assicurati che il blocco pop up non sia attivo)"},"github":{"title":"con GitHub","message":"Autenticazione con GitHub (assicurati che il blocco pop up non sia attivo)"}},"composer":{"posting_not_on_topic":"A quale argomento vuoi rispondere?","saving_draft_tip":"salvataggio","saved_draft_tip":"salvato","saved_local_draft_tip":"salvato in locale","similar_topics":"Il tuo argomento è simile a...","drafts_offline":"bozze offline","min_length":{"need_more_for_title":"{{n}} per andare al titolo","need_more_for_reply":"Ancora {{n}} per arrivare al messaggio"},"error":{"title_missing":"Il titolo è richiesto","title_too_short":"Il titolo deve essere lungo almeno {{min}} caratteri","title_too_long":"Il titolo non può essere più lungo di {{max}} caratteri","post_missing":"Il messaggio non può essere vuoto","post_length":"Il messaggio deve essere lungo almeno {{min}} caratteri","category_missing":"Devi scegliere una categoria"},"save_edit":"Salva Modifiche","reply_original":"Rispondi all'Argomento Originale","reply_here":"Rispondi Qui","reply":"Rispondi","cancel":"Annulla","create_topic":"Crea Argomento","create_pm":"Crea Messaggio Privato","title":"O premi Ctrl+Enter","users_placeholder":"Aggiunti un utente","title_placeholder":"In breve, di cosa tratta questa discussione?","edit_reason_placeholder":"perché stai scrivendo?","show_edit_reason":"(aggiungi motivo della modifica)","reply_placeholder":"Scrivi qui. Per formattare il testo, usa Markdown o BBCode. Trascina o incolla un'immagine per caricarla.","view_new_post":"Visualizza il tuo nuovo messaggio.","saving":"Salvataggio...","saved":"Salvato!","saved_draft":"Hai un messaggio in bozza in sospeso. Clicca su questa barra per riprendere la modifica.","uploading":"In caricamento...","show_preview":"visualizza anteprima \u0026raquo;","hide_preview":"\u0026laquo; nascondi anteprima","quote_post_title":"Cita l'intero messaggio","bold_title":"Grassetto","bold_text":"testo in grassetto","italic_title":"Italic","italic_text":"testo italic","link_title":"Collegamento","link_description":"inserisci qui la descrizione del collegamento","link_dialog_title":"Inserisci il collegamento","link_optional_text":"titolo opzionale","quote_title":"Citazione","quote_text":"Citazione","code_title":"Testo preformattato","code_text":"rientra il testo preformattato di 4 spazi","upload_title":"Carica","upload_description":"inserisci qui la descrizione del caricamento","olist_title":"Elenco Numerato","ulist_title":"Elenco Puntato","list_item":"Elemento lista","heading_title":"Intestazione","heading_text":"Intestazione","hr_title":"Linea Orizzontale","undo_title":"Annulla","redo_title":"Ripeti","help":"Aiuto Inserimento Markdown","toggler":"nascondi o mostra il pannello di editing","admin_options_title":"Impostazioni dello staff opzionali per l'argomento","auto_close_label":"Tempo di chiusura automatica del topic:","auto_close_units":"(n° ore, un'orario, o un timestamp)","auto_close_examples":"inserisci orario assoluto o numero di ore - 24, 17:00, 2013-11-22 14:00","auto_close_error":"Per favore immetti un valore valido."},"notifications":{"title":"notifiche di quando @name viene citato, se ci sono risposte ai tuoi messaggi e argomenti, messaggi privati ecc.","none":"Non hai notifiche al momento.","more":"visualizza le notifiche precedenti","total_flagged":"totale argomenti segnalati","mentioned":"\u003ci title='mentioned' class='icon'\u003e@\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='quoted' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='edited' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='accepted your invitation' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003eha accettato il tuo invito\u003c/p\u003e","moved_post":"\u003ci title='moved post' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e ha spostato {{description}}\u003c/p\u003e","linked":"\u003ci title='linked post' class='fa fa-arrow-left'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='badge granted' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eGuadagnato '{{description}}'\u003c/p\u003e"},"upload_selector":{"title":"Aggiungi un'immagine","title_with_attachments":"Aggiungi un'immagine o un file","from_my_computer":"Dal mio dispositivo","from_the_web":"Dal web","remote_tip":"collegamento all'immagine http://example.com/image.jpg","remote_tip_with_attachments":"collegamento all'immagine o al file http://example.com/file.ext (estensioni permesse: {{authorized_extensions}}).","local_tip":"clicca per selezionare un'immagine dal tuo dispositivo","local_tip_with_attachments":"clicca per selezionare un'immagine o un file dal tuo dispositivo (estensioni permesse: {{authorized_extensions}})","hint":"(puoi anche trascinarle nell'editor per caricarle)","hint_for_supported_browsers":"(puoi anche trascinare o incollare immagini nell'editor per caricarle)","uploading":"In caricamento","image_link":"collegamento a cui la tua immagine punterà"},"search":{"title":"cerca argomenti, messaggi, utenti o categorie","no_results":"Nessun risultato trovato.","searching":"Ricerca in corso...","context":{"user":"Cerca messaggi di @{{username}}","category":"Cerca nella categoria \"{{category}}\"","topic":"Cerca in questo argomento"}},"site_map":"vai a un altro elenco di argomenti o categoria","go_back":"indietro","not_logged_in_user":"pagina utente con riassunto delle attività correnti e delle impostazioni","current_user":"vai alla pagina utente","starred":{"title":"Preferito","help":{"star":"aggiungi questo argomento alla lista dei preferiti","unstar":"Elimina questo argomento dalla lista dei preferiti"}},"topics":{"bulk":{"reset_read":"Reimposta Lettura","delete":"Elimina Argomenti","dismiss_posts":"Chiudi Messaggi","dismiss_posts_tooltip":"Azzera il contatore dei messaggi non-letti di questi argomenti, ma quando vengono creati nuovi messaggi continua a mostrarli nella mia lista dei non-letti ","dismiss_topics":"Chiudi Argomenti","dismiss_topics_tooltip":"Quando viene creato un nuovo messaggio, non mostrare più questi argomenti nella mia lista dei non-letti ","dismiss_new":"Chiudi Nuovo","toggle":"commuta la selezione multipla degli argomenti","actions":"Azioni Multiple","change_category":"Cambia Categoria","close_topics":"Chiudi Argomenti","notification_level":"Cambia Livello Notifiche","selected":{"one":"Hai selezionato \u003cb\u003e1\u003c/b\u003e topic.","other":"Hai selezionato \u003cb\u003e{{count}}\u003c/b\u003e argomenti."}},"none":{"starred":"Ancora non hai inserito nessun argomento nei preferiti. Per aggiungerne uno, clicca sulla stella vicino al titolo.","unread":"Non ci sono argomenti non letti.","new":"Non ci sono nuovi argomenti.","read":"Non hai ancora letto nessun argomento.","posted":"Non hai ancora scritto in nessun argomento.","latest":"Non ci sono argomenti più recenti. Ciò è triste.","hot":"Non ci sono argomenti caldi.","category":"Non ci sono argomenti in {{category}}.","top":"Non ci sono argomenti di punta.","educate":{"new":"\u003cp\u003ePer default, gli argomenti creati negli ultimi 2 giorni sono considerati nuovi. Puoi cambiare questa configurazione nelle tue \u003ca href=\"%{userPrefsUrl}\"\u003eopzioni\u003c/a\u003e.\u003c/p\u003e","unread":"\u003cp\u003ePer default, gli indicatori di argomento non-letto appariranno solo se hai:\u003c/p\u003e\u003cul\u003e\u003cli\u003eCreato\u003c/li\u003e\u003cli\u003eRisposto\u003c/li\u003e\u003cli\u003eLetto per più di 4 minuti\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eOppure se hai esplicitamente impostato l'argomento come Seguito o Osservato nel pannello di notifica in fondo ad ogni argomento.\u003c/p\u003e\u003cp\u003ePuoi cambiare questa configurazione nelle tue \u003ca href=\"%{userPrefsUrl}\"\u003eopzioni\u003c/a\u003e.\u003c/p\u003e"}},"bottom":{"latest":"Non ci sono altri argomenti più recenti.","hot":"Non ci sono altri argomenti caldi.","posted":"Non ci sono altri argomenti pubblicati.","read":"Non ci sono altri argomenti letti.","new":"Non ci sono altri argomenti nuovi.","unread":"Non ci sono altri argomenti non letti","starred":"Non ci sono altri argomenti nei preferiti.","category":"Non ci sono altri argomenti nella categoria {{category}}.","top":"Non ci sono altri argomenti di punta."}},"topic":{"filter_to":"{{post_count}} messaggi in questo argomento","create":"Crea Argomento","create_long":"Crea un nuovo Argomento","private_message":"Inizia un messaggio privato","list":"Argomenti","new":"nuovo argomento","unread":"non letto","new_topics":{"one":"1 nuovo topic","other":"{{count}} nuovi argomenti"},"unread_topics":{"one":"1 topic non letto","other":"{{count}} argomenti non letti"},"title":"Argomento","loading_more":"Caricamento di altri argomenti...","loading":"Caricamento dell'argomento...","invalid_access":{"title":"L'argomento è privato","description":"Spiacenti, non puoi accedere a questo argomento!","login_required":"Devi connetterti per vedere questo argomento."},"server_error":{"title":"Errore di caricamento dell'argomento","description":"Spiacenti, non è stato possibile caricare questo argomento, probabilmente per un errore di connessione. Per favore riprova. Se il problema persiste, faccelo sapere."},"not_found":{"title":"Argomento non trovato","description":"Spiacenti, non abbiamo trovato l'argomento. Forse è stato rimosso da un moderatore?"},"total_unread_posts":{"one":"c'è un post non letto in questa discussione","other":"hai {{count}} messagi non letti in questo argomento"},"unread_posts":{"one":"Hai 1 post non letto in questo topic","other":"hai {{count}} vecchi messaggi non letti in questo argomento"},"new_posts":{"one":"1 nuovo post in questo topic dal tuo ultimo accesso","other":"ci sono {{count}} nuovi messaggi in questo argomento dal tuo ultimo accesso"},"likes":{"one":"C'è 1 nuovo \"Mi piace\" in questo topic","other":"ci sono {{count}} \"Mi piace\" in questo argomento"},"back_to_list":"Torna alla Lista Argomenti","options":"Opzioni Argomento","show_links":"mostra i collegamenti in questo argomento","toggle_information":"commuta i dettagli dell'argomento","read_more_in_category":"Vuoi saperne di più? Leggi altri argomenti in {{catLink}} o {{latestLink}}.","read_more":"Vuoi saperne di più? {{catLink}} o {{latestLink}}.","browse_all_categories":"Scorri tutte le categorie","view_latest_topics":"visualizza gli argomenti più recenti","suggest_create_topic":"Perché non crei un argomento?","jump_reply_up":"passa a una risposta precedente","jump_reply_down":"passa a una risposta successiva","deleted":"L'argomento è stato cancellato","auto_close_notice":"Questo argomento si chiuderà automaticamente %{timeLeft}.","auto_close_title":"Impostazioni di auto-chiusura","auto_close_save":"Salva","auto_close_remove":"Non chiudere automaticamente questo Argomento","progress":{"title":"Avanzamento dell'argomento","go_top":"alto","go_bottom":"basso","go":"vai","jump_bottom_with_number":"Passa al messaggio %{post_number}","total":"totale messaggi","current":"messaggio corrente","position":"messaggio %{current} di %{total}"},"notifications":{"reasons":{"3_6":"Riceverai notifiche perché stai monitorando questa categoria.","3_5":"Riceverai notifiche poiché hai iniziato a monitorare questo argomento automaticamente.","3_2":"Riceverai notifiche perché stai monitorando questo argomento.","3_1":"Riceverai notifiche perché hai creato questo argomento.","3":"Riceverai notifiche perché stai monitorando questo argomento.","2_8":"Riceverai notifiche perché stai seguendo questa categoria.","2_4":"Riceverai notifiche perché hai pubblicato una risposta a questo argomento.","2_2":"Riceverai notifiche perché stai seguendo questo argomento.","2":"Riceverai notifiche perché \u003ca href=\"/users/{{username}}/preferences\"\u003ehai letto questo argomento\u003c/a\u003e.","1_2":"Riceverai notifiche solo se qualcuno menziona il tuo @name o risponde a un tuo messaggio.","1":"Riceverai notifiche solo se qualcuno menziona il tuo @name o risponde a un tuo messaggio.","0_7":"Stai ignorando tutte le notifiche di questa categoria.","0_2":"Stai ignorando tutte le notifiche di questo argomento.","0":"Stai ignorando tutte le notifiche di questo argomento."},"watching_pm":{"title":"In osservazione","description":"Riceverai notifiche di ogni nuovo messaggio in questo messaggio privato. Un conteggio dei messaggi non letti e nuovi comparirà anche di fianco alla lista degli argomenti."},"watching":{"title":"In osservazione","description":"Riceverai notifiche per ogni nuovo messaggio in questo argomento. Un conteggio dei messaggio non letti e nuovi comparirà anche di fianco alla lista degli argomenti."},"tracking_pm":{"title":"Seguito","description":"Un conteggio dei messaggio non letti e nuovi apparirà vicino al messaggio privato. Riceverai una notifica solo se qualcuno menziona il tuo @name o risponde al tuo messaggio."},"tracking":{"title":"Seguito","description":"Un conteggio dei messaggio non letti e nuovi apparirà vicino alla lista degli argomenti. Riceverai una notifica solo se qualcuno menzionerà il tuo @name o risponderà al tuo messaggio."},"regular":{"title":"Normale","description":"Riceverai notifiche solo se qualcuno menziona il tuo @name o risponde al tuo messaggio."},"regular_pm":{"title":"Normale","description":"Riceverai notifiche solo se qualcuno menziona il tuo @name o risponde al tuo messaggio all'interno del messaggio privato."},"muted_pm":{"title":"Ignorato","description":"Non ti verrà notificato nulla di questo messaggio privato."},"muted":{"title":"Ignorato","description":"Non ti verrà notificato nulla di questo argomento e non comparirà nella tab dei non letti."}},"actions":{"recover":"Ripristina l'argomento","delete":"Cancella l'argomento","open":"Apri l'argomento","close":"Chiudi l'argomento","auto_close":"Chiudi Automaticamente","make_banner":"Argomento Annuncio","remove_banner":"Rimuovi Argomento Annuncio","unpin":"Spunta Argomento","pin":"Appunta Argomento","pin_globally":"Appunta Argomento Globalmente","unarchive":"De-archivia Argomento","archive":"Archivia Argomento","invisible":"Rendi Invisibile","visible":"Rendi Visibile","reset_read":"Reimposta Dati Letti","multi_select":"Seleziona Messaggi"},"reply":{"title":"Rispondi","help":"inizia a scrivere una risposta in questo argomento"},"clear_pin":{"title":"Spunta","help":"Rimuovi la spunta da questo argomento, così non comparirà più in cima alla lista degli argomenti"},"share":{"title":"Condividi","help":"Condividi un collegamento a questo argomento"},"flag_topic":{"title":"Segnala","help":"segnala questo argomento o invia una notifica privata","success_message":"Hai segnalato questo argomento con successo."},"inviting":"Sto invitando...","automatically_add_to_groups_optional":"Questo invito include anche l'accesso ai seguenti gruppi: (opzionale, solo amministratori)","automatically_add_to_groups_required":"Questo invito include anche l'accesso ai seguenti gruppi: (\u003cb\u003eRichiesto\u003c/b\u003e, solo amministratori)","invite_private":{"title":"Richiedi un Messaggio Privato","email_or_username":"Email o Utente di chi invita","email_or_username_placeholder":"indirizzo email o nome utente","action":"Invita","success":"Abbiamo invitato l'utente a partecipare a questo messaggio privato.","error":"Spiacenti, si è verificato un errore durante l'invito dell'utente.","group_name":"nome gruppo"},"invite_reply":{"title":"Invita","action":"Invita via email","help":"invia inviti agli amici così potranno rispondere a questo argomento con un solo click","to_topic":"Invieremo una breve email che permetterà al tuo amico di entrare immediatamente e rispondere a questo argomento cliccando su un collegamento, non sarà necessario effettuare il login.","to_forum":"Invieremo una breve email che permetterà al tuo amico di entrare subito cliccando un collegamento, senza bisogno di effettuare il login.","email_placeholder":"nome@esempio.com","success":"Abbiamo mandato un invito a \u003cb\u003e{{email}}\u003c/b\u003e. Ti invieremo una notifica quando l'invito verrà confermato. Controlla gli inviti dal tab sulla tua pagina utente per tenere traccia dei tuoi inviti.","error":"Spiacenti, non possiamo invitare quella persona. Forse è già un utente?"},"login_reply":"Connettiti per Rispondere","filters":{"n_posts":{"one":"1 post","other":"{{count}} messaggi"},"cancel":"Mostra nuovamente tutti i messaggi in questo argomento."},"split_topic":{"title":"Sposta in un Nuovo Argomento","action":"sposta in un nuovo argomento","topic_name":"Nuovo Nome Argomento","error":"Si è verificato un errore spostando il messaggio nel nuovo argomento.","instructions":{"one":"Stai per creare un nuovo argomento e riempirlo con il messaggio che hai selezionato.","other":"Stai per creare un nuovo argomento e riempirlo con i \u003cb\u003e{{count}}\u003c/b\u003e messaggi che hai selezionato."}},"merge_topic":{"title":"Sposta in Argomento Esistente","action":"sposta in un argomento esistente","error":"Si è verificato un errore nello spostare i messaggi nell'argomento.","instructions":{"one":"Per favore scegli l'argomento dove spostare il messaggio.","other":"Per favore scegli l'argomento di destinazione dove spostare i \u003cb\u003e{{count}}\u003c/b\u003e messaggi."}},"change_owner":{"title":"Cambia Proprietario dei Messaggi","action":"cambia proprietà","error":"Si è verificato un errore durante il cambio di proprietà dei messaggi.","label":"Nuovo Proprietario dei Messaggi","placeholder":"nome utente del nuovo proprietario","instructions":{"one":"Seleziona il nuovo proprietario del post di \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Seleziona il nuovo proprietario dei {{count}} messaggi di \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"Nota che ogni notifica circa questo messaggio non verrà trasferita al nuovo utente in modo retroattivo.\u003cbr\u003eAttenzione: al momento nessun dato messaggio-dipendente è stato trasferito al nuovo utente. Usare con cautela."},"multi_select":{"select":"scegli","selected":"selezionati ({{count}})","select_replies":"seleziona +risposte","delete":"elimina i selezionati","cancel":"annulla selezione","select_all":"seleziona tutto","deselect_all":"deseleziona tutto","description":{"one":"Hai selezionato 1 post.","other":"Hai selezionato \u003cb\u003e{{count}}\u003c/b\u003e messaggi."}}},"post":{"reply":"Rispondi a {{link}} da parte di {{replyAvatar}} {{username}}","reply_topic":"Rispondi a {{link}}","quote_reply":"rispondi citando","edit":"Modifica {{link}} di {{replyAvatar}} {{username}}","edit_reason":"Motivo:","post_number":"messaggio {{number}}","in_reply_to":"rispondi a","last_edited_on":"ultima modifica al messaggio:","reply_as_new_topic":"Rispondi come nuovo Messaggio","continue_discussion":"Continua la discussione da {{postLink}}:","follow_quote":"vai al messaggio citato","show_full":"Mostra Messaggio Completo","show_hidden":"Visualizza contenuto nascosto.","deleted_by_author":{"one":"(post eliminato dall'autore, sarà automaticamente cancellato in %{count} ore se non contrassegnato)","other":"(messaggio eliminato dall'autore, verrà automaticamente cancellato in %{count} ore se non segnalato)"},"expand_collapse":"espandi/raggruppa","gap":{"one":"1 post nascosto","other":"{{count}} messaggi nascosti"},"more_links":"{{count}} altri...","unread":"Messaggio non letto","has_replies":{"one":"Risposta","other":"Risposte"},"errors":{"create":"Spiacenti, si è verificato un errore nel creare il tuo messaggio. Prova di nuovo.","edit":"Spiacenti, si è verificato un errore nel modificare il tuo messaggio. Prova di nuovo.","upload":"Spiacenti, si è verificato un errore durante il caricamento del file. Prova di nuovo.","attachment_too_large":"Spiacenti, il file che stai tentando di caricare è troppo grande (il massimo consentito è {{max_size_kb}}kb).","image_too_large":"Spiacenti, l'immagine che stai cercando di caricare è troppo grande (la dimensione massima è {{max_size_kb}}kb). Ridimensionala e riprova.","too_many_uploads":"Spiacenti, puoi caricare un solo file per volta.","upload_not_authorized":"Spiacenti, il file che stai cercando di caricare non è autorizzato (estensioni autorizzate: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Spiacenti, i nuovi utenti non possono caricare immagini.","attachment_upload_not_allowed_for_new_user":"Spiacenti, i nuovi utenti non possono caricare allegati."},"abandon":{"confirm":"Sicuro di voler abbandonare il tuo messaggio?","no_value":"No, mantienilo","yes_value":"Si, abbandona"},"wiki":{"about":"questo messaggio è una guida; gli utenti normali possono modificarla"},"archetypes":{"save":"Opzioni di salvataggio"},"controls":{"reply":"inizia a comporre una risposta a questo messaggio","like":"il messaggio mi piace","has_liked":"ti è piaciuto questo messaggio","undo_like":"rimuovi \"mi piace\"","edit":"modifica questo messaggio","edit_anonymous":"Spiacente, effettua l'accesso per poter modificare questo messaggio.","flag":"segnala privatamente questo post o invia una notifica privata","delete":"cancella questo messaggio","undelete":"recupera questo messaggio","share":"condividi un collegamento a questo messaggio","more":"Di più","delete_replies":{"confirm":{"one":"Vuoi anche cancellare la risposta diretta a questo post?","other":"Vuoi anche cancellare le {{count}} risposte dirette a questo messaggio?"},"yes_value":"Si, cancella anche le risposte","no_value":"No, solo questo messaggio"},"admin":"azioni post-amministrazione","wiki":"Aggiungi messaggio a Wiki","unwiki":"Rimuovi il messaggio da Wiki"},"actions":{"flag":"Segnala","defer_flags":{"one":"Ignora segnalazione","other":"Annulla segnalazioni"},"it_too":{"off_topic":"Segnalalo anche tu","spam":"Segnalalo anche tu","inappropriate":"Segnalalo anche tu","custom_flag":"Segnalalo anche tu","bookmark":"Aggiungi un segnalibro anche tu","like":"Assegnagli un \"mi piace\" anche tu","vote":"Votalo anche tu"},"undo":{"off_topic":"Rimuovi segnalazione","spam":"Rimuovi segnalazione","inappropriate":"Rimuovi segnalazione","bookmark":"Annulla segnalibro","like":"Annulla il \"mi piace\"","vote":"Rimuovi voto"},"people":{"off_topic":"{{icons}} l'hanno segnalato come fuori tema","spam":"{{icons}} l'hanno segnalato come spam","inappropriate":"{{icons}} l'hanno segnalato come inappropriato","notify_moderators":"{{icons}} hanno informato i moderatori","notify_moderators_with_url":"{{icons}} \u003ca href='{{postUrl}}'\u003ehanno informato i moderatori\u003c/a\u003e","notify_user":"{{icons}} hanno inviato un messaggio privato","notify_user_with_url":"{{icons}} hanno invitao un \u003ca href='{{postUrl}}'\u003emessaggio privato\u003c/a\u003e","bookmark":"{{icons}} l'hanno inserito nei segnalibri","like":"A {{icons}} è piaciuto","vote":"{{icons}} l'hanno votato"},"by_you":{"off_topic":"L'hai segnalato come fuori tema","spam":"L'hai segnalato come spam","inappropriate":"L'hai segnalato come inappropriato","notify_moderators":"L'hai segnalato per la moderazione","notify_user":"Hai inviato un messaggio privato a questo utente","bookmark":"Hai inserito questo messaggio nei segnalibri","like":"Ti piace","vote":"Hai votato per questo post"},"by_you_and_others":{"off_topic":{"one":"Tu e un'altra persona lo avete contrassegnato come fuori tema","other":"Tu e {{count}} altre persone lo avete contrassegnato come fuori tema"},"spam":{"one":"Tu e un'altra persona lo avete contrassegnato come spam","other":"Tu e {{count}} altre persona lo avete contrassegnato come spam"},"inappropriate":{"one":"Tu e un'altra persona lo avete contrassegnato come non appropriato","other":"Tu e  {{count}} altre persone lo avete contrassegnato come non appropriato"},"notify_moderators":{"one":"Tu e un'altra persona lo avete contrassegnato per la moderazione","other":"Tu e {{count}} altre persone lo avete contrassegnato per la moderazione"},"notify_user":{"one":"Tu e un'altra persona avete inviato un messaggio privato a questo utente","other":"Tu e {{count}} altre persone avete inviato un messaggio privato a questo utente"},"bookmark":{"one":"Tu e un'altra persona avete inserito questo messaggio nei segnalibri","other":"Tu e {{count}} altre persone avete inserito questo messaggio nei segnalibri"},"like":{"one":"A te e a un'altra persona è piaciuto","other":"A te e a {{count}} altre persone è piaciuto"},"vote":{"one":"Tu e un'altra persona avete votato per questo messaggio","other":"Tu e {{count}} altre persone avete votato per questo messaggio"}},"by_others":{"off_topic":{"one":"Una persona lo ha contrassegnato come fuori tema","other":"{{count}} persone lo hanno contrassegnato come fuori tema"},"spam":{"one":"Una persona lo ha contrassegnato come spam","other":"{{count}} persone lo hanno contrassegnato come spam"},"inappropriate":{"one":"Una persona lo ha contrassegnato come non appropriato","other":"{{count}} persone lo hanno contrassegnato come non appropriato"},"notify_moderators":{"one":"Una persona lo ha contrassegnato per la moderazione","other":"{{count}} persone lo hanno contrassegnato per la moderazione"},"notify_user":{"one":"Una persona ha inviato un messaggio privato a questo utente","other":"{{count}} persone hanno inviato un messaggio privato a questo utente"},"bookmark":{"one":"Una persona ha inserito un segnalibro a questo post","other":"{{count}} persone hanno inserito un segnalibro a questo post"},"like":{"one":"A una persona è piaciuto","other":"A {{count}} persone è piaciuto"},"vote":{"one":"Una persona ha votato per questo post","other":"{{count}} persone hanno votato per questo post"}}},"edits":{"one":"1 modifica","other":"{{count}} modifiche","zero":"nessuna modifica"},"delete":{"confirm":{"one":"Sei sicuro di voler cancellare questo messaggio?","other":"Sei sicuro di voler cancellare tutti questi messaggi?"}},"revisions":{"controls":{"first":"Prima revisione","previous":"Revisione precedente","next":"Prossima revisione","last":"Ultima revisione","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e#{{previous}}\u003c/strong\u003e vs. \u003cstrong\u003e#{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Mostra il risultato con le aggiunte e le rimozioni in linea","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Mostra le differenze del risultato fianco a fianco","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Mostra le differenze di markdown fianco a fianco","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Markdown"}},"details":{"edited_by":"Modificato da"}}},"category":{"can":"può\u0026hellip;","none":"(nessuna categoria)","choose":"Seleziona una categoria\u0026hellip;","edit":"modifica","edit_long":"Modifica","view":"Visualizza Argomenti della Categoria","general":"Generale","settings":"Impostazioni","delete":"Elimina Categoria","create":"Crea Categoria","save":"Salva Categoria","creation_error":"Si è verificato un errore nella creazione della categoria.","save_error":"Si è verificato un errore durante il salvataggio della categoria.","name":"Nome Categoria","description":"Descrizione","topic":"argomento della categoria","logo":"Immagine Categoria","background_image":"Immagine di sfondo della categoria","badge_colors":"Colori delle targhette","background_color":"Colore di sfondo","foreground_color":"Colore in primo piano","name_placeholder":"Una o due parole al massimo","color_placeholder":"Qualsiasi colore web","delete_confirm":"Sei sicuro di voler cancellare questa categoria?","delete_error":"Si è verificato un errore durante la cancellazione della categoria.","list":"Elenca Categorie","no_description":"Aggiungi una descrizione alla categoria.","change_in_category_topic":"Modifica Descrizione","already_used":"Questo colore è già stato usato in un'altra categoria.","security":"Sicurezza","images":"Immagini","auto_close_label":"Chiudi automaticamente l'argomento dopo:","auto_close_units":"ore","email_in":"Indirizzo email personalizzato:","email_in_allow_strangers":"Accetta email da utenti anonimi senza alcun account","email_in_disabled":"Le Impostazioni Sito non permettono di creare nuovi argomenti via email. Per abilitare la creazione di argomenti via email,","email_in_disabled_click":"abilita l'impostazione \"email entrante\".","allow_badges_label":"Permetti che le targhette vengano assegnate in questa categoria","edit_permissions":"Modifica Permessi","add_permission":"Aggiungi Permesso","this_year":"quest'anno","position":"posizione","default_position":"Posizione di default","position_disabled":"Le categorie verranno mostrate in ordine d'attività. Per modificare l'ordinamento delle categorie nelle liste,","position_disabled_click":"attiva l'impostazione \"posizione fissa delle categorie\".","parent":"Categoria Superiore","notifications":{"watching":{"title":"In osservazione","description":"Seguirai automaticamente tutti i nuovi argomenti in queste categorie. Riceverai notifiche su tutti i nuovi messaggi e argomenti. Inoltre, di fianco all'elenco di argomenti, apparirà il conteggio di quelli non letti e di quelli nuovi."},"tracking":{"title":"Seguendo","description":"Seguirai automaticamente tutti i nuovi argomenti di queste categorie. Il conteggio dei messaggi nuovi e non letti comparirà di fianco all'elenco degli argomenti."},"regular":{"title":"Normale","description":"Riceverai notifiche solo se qualcuno menziona il tuo @nome o risponde a un tuo messaggio."},"muted":{"title":"Ignorato","description":"Non ti verrà notificato nulla sui nuovi argomenti di queste categorie, e non compariranno nella tua  tab dei non letti."}}},"flagging":{"title":"Perché vuoi contrassegnare questo post?","action":"Segnala Messaggio","take_action":"Procedi","notify_action":"Messaggio privato","delete_spammer":"Cancella Spammer","delete_confirm":"Stai per eliminare \u003cb\u003e%{posts}\u003c/b\u003e messaggi e \u003cb\u003e%{topics}\u003c/b\u003e argomenti di questo utente, rimuovere il suo account, bloccare le iscrizioni da questo indirizzo IP \u003cb\u003e%{ip_address}\u003c/b\u003e, e aggiungere il suo indirizzo email \u003cb\u003e%{email}\u003c/b\u003e all'elenco di quelli bloccati. Sei sicuro che questo utente sia davvero uno spammer?","yes_delete_spammer":"Sì, cancella lo spammer","submit_tooltip":"Invia la segnalazione privata","take_action_tooltip":"Raggiungi la soglia di segnalazioni immediatamente, piuttosto che aspettare altre segnalazioni della comunità","cant":"Spiacenti, al momento non puoi segnalare questo messaggio.","custom_placeholder_notify_user":"Perché questo messaggio ti spinge a contattare l'utente direttamente e privatamente? Sii puntuale e costruttivo e sempre gentile.","custom_placeholder_notify_moderators":"Perché questo messaggio richiede l'attenzione dei moderatori? Facci sapere nello specifico cosa ti preoccupa, e fornisci collegamenti pertinenti se possibile.","custom_message":{"at_least":"inserisci almeno {{n}} caratteri","more":"{{n}} alla fine...","left":"{{n}} rimanenti"}},"flagging_topic":{"title":"Perché vuoi contrassegnare questo argomento?","action":"Segnala Argomento","notify_action":"Messaggio privato"},"topic_map":{"title":"Riassunto Argomento","links_shown":"mostra tutti i {{totalLinks}} collegamenti...","clicks":{"one":"1 click","other":"%{count} click"}},"topic_statuses":{"locked":{"help":"Questo argomento è chiuso; non sono ammesse nuove risposte"},"unpinned":{"title":"Spuntato","help":"Questo argomento è spuntato; verrà mostrato con l'ordinamento di default"},"pinned_globally":{"title":"In Evidenza Globalmente","help":"Questo topic è in evidenza globalmente; verrà mostrato in cima ad ogni lista"},"pinned":{"title":"In Evidenza","help":"Questo argomento è in evidenza; verrà mostrato in cima alla sua categoria"},"archived":{"help":"Questo argomento è archiviato; è bloccato e non può essere modificato"},"invisible":{"help":"Questo argomento è invisibile; non verrà mostrato nella lista degli argomenti ed è possibile accedervi solo tramite collegamento diretto"}},"posts":"Messaggi","posts_lowercase":"messaggi","posts_long":"ci sono {{number}} messaggi in questo argomento","original_post":"Messaggio Originale","views":"Visualizzazioni","views_lowercase":"visualizzazioni","replies":"Risposte","views_long":"questo topic è stato visualizzato {{number}} volte","activity":"Attività","likes":"Mi piace","likes_lowercase":"mi piace","likes_long":"ci sono {{number}} \"Mi piace\" in questo argomento","users":"Utenti","users_lowercase":"utenti","category_title":"Categoria","history":"Storia","changed_by":"da {{author}}","categories_list":"Lista Categorie","filters":{"with_topics":"%{filter} argomenti","with_category":"%{filter} %{category} argomenti","latest":{"title":"Più recenti","help":"argomenti con messaggi recenti"},"hot":{"title":"Caldo","help":"una selezione degli argomenti più caldi"},"starred":{"title":"Preferiti","help":"argomenti che hai messo nei preferiti"},"read":{"title":"Letti","help":"argomenti che hai letto, in ordine di lettura"},"categories":{"title":"Categorie","title_in":"Categoria - {{categoryName}}","help":"tutti gli argomenti raggruppati per categoria"},"unread":{"title":{"zero":"Non letti","one":"Non letto (1)","other":"Non letti ({{count}})"},"help":"argomenti che stai guardando o seguendo contenenti messaggi non letti","lower_title_with_count":{"one":"1 non letto","other":"{{count}} non letti"}},"new":{"lower_title_with_count":{"one":"1 nuovo","other":"{{count}} nuovi"},"lower_title":"nuovo","title":{"zero":"Nuovi","one":"Nuovo (1)","other":"Nuovi ({{count}})"},"help":"argomenti creati negli ultimi giorni"},"posted":{"title":"I miei Messaggi","help":"argomenti in cui hai scritto"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"ultimi argomenti nella categoria {{categoryName}}"},"top":{"title":"Alto","help":"gli argomenti più attive nell'ultimo anno, mese, settimana o giorno","yearly":{"title":"Migliori dell'anno"},"monthly":{"title":"Migliori del mese"},"weekly":{"title":"Migliori della settimana"},"daily":{"title":"Migliori del giorno"},"this_year":"Quest'anno","this_month":"Questo mese","this_week":"Questa settimana","today":"Oggi","other_periods":"vedi altri argomenti di punta"}},"permission_types":{"full":"Crea / Rispondi / Visualizza","create_post":"Rispondi / Visualizza","readonly":"Visualizza"},"poll":{"voteCount":{"one":"1 voto","other":"%{count} voti"},"results":{"show":"Mostra Risultati","hide":"Nascondi Risultati"},"close_poll":"Chiudi Sondaggio","open_poll":"Apri Sondaggio"},"type_to_filter":"digita per filtrare...","admin":{"title":"Amministratore Discourse","moderator":"Moderatore","dashboard":{"title":"Cruscotto","last_updated":"Ultimo aggiornamento cruscotto:","version":"Versione","up_to_date":"Sei aggiornato!","critical_available":"È disponibile un aggiornamento essenziale.","updates_available":"Sono disponibili aggiornamenti.","please_upgrade":"Per favore effettua un aggiornamento!","no_check_performed":"Non è stato effettuato un controllo sugli aggiornamenti. Assicurati che sidekiq sia attivo.","stale_data":"Non è stato effettuato un controllo recente sugli aggiornamenti. Assicurati che sidekiq sia attivo.","version_check_pending":"Sembra che tu abbia aggiornato di recente. Ottimo!","installed_version":"Installata","latest_version":"Ultimi","problems_found":"Si sono verificati dei problemi con la tua installazione di Discourse:","last_checked":"Ultimo controllo","refresh_problems":"Aggiorna","no_problems":"Nessun problema rilevato.","moderators":"Moderatori:","admins":"Amministratori:","blocked":"Bloccati:","suspended":"Sospesi: ","private_messages_short":"MP","private_messages_title":"Messaggi Privati","reports":{"today":"Oggi","yesterday":"Ieri","last_7_days":"Ultimi 7 Giorni","last_30_days":"Ultimi 30 Giorni","all_time":"Di Sempre","7_days_ago":"7 Giorni Fa","30_days_ago":"30 Giorni Fa","all":"Tutti","view_table":"Visualizza come Tabella","view_chart":"Visualizza come Grafico a Barre"}},"commits":{"latest_changes":"Ultime modifiche: per favore aggiorna spesso!","by":"da"},"flags":{"title":"Segnalazioni","old":"Vecchi","active":"Attivi","agree":"Acconsento","agree_title":"Conferma che questa segnalazione è valida e corretta","agree_flag_modal_title":"Acconsento e...","agree_flag_hide_post":"D'accordo (nascondi il messaggio e invia MP)","agree_flag_hide_post_title":"Nascondi questo messaggio e invia automaticamente all'utente un messaggio privato chiedendogli di modificarlo","agree_flag":"Accetta la segnalazione","agree_flag_title":"Accetta la segnalazione e non modificare il messaggio","defer_flag":"Ignora","defer_flag_title":"Rimuovi segnalazione; non è necessaria alcuna azione questa volta.","delete":"Cancella","delete_title":"Cancella il messaggio a cui si riferisce la segnalazione.","delete_post_defer_flag":"Cancella il messaggio e Ignora la segnalazione","delete_post_defer_flag_title":"Cancella il messaggio: se è il primo, cancella l'argomento","delete_post_agree_flag":"Elimina messaggio e Accetta la segnalazione","delete_post_agree_flag_title":"Cancella il messaggio: se è il primo, cancella l'argomento","delete_flag_modal_title":"Cancella e...","delete_spammer":"Cancella lo Spammer","delete_spammer_title":"Rimuovi l'utente e tutti i suoi messaggi ed argomenti.","disagree_flag_unhide_post":"Rifiuta (mostra il messaggio)","disagree_flag_unhide_post_title":"Rimuovi ogni segnalazione dal messaggio e rendilo nuovamente visibile","disagree_flag":"Rifiuta","disagree_flag_title":"Nega questa segnalazione perché non valida o non corretta","clear_topic_flags":"Fatto","clear_topic_flags_title":"L'argomento è stato esaminato e i problemi risolti. Clicca su Fatto per rimuovere le segnalazioni.","more":"(altre risposte...)","dispositions":{"agreed":"accettate","disagreed":"non accettate","deferred":"ignorate"},"flagged_by":"Segnalato da","resolved_by":"Risolto da","took_action":"Azione intrapresa","system":"Sistema","error":"Qualcosa non ha funzionato","reply_message":"Rispondi","no_results":"Non ci sono segnalazioni.","topic_flagged":"Questo \u003cstrong\u003eargomento\u003c/strong\u003e è stato segnalato.","visit_topic":"Visita l'argomento per intervenire","was_edited":"Il messaggio è stato modificato dopo la prima segnalazione","summary":{"action_type_3":{"one":"off-topic ","other":"fuori tema x{{count}}"},"action_type_4":{"one":"inappropriato","other":"inappropriati x{{count}}"},"action_type_6":{"one":"personalizzato","other":"personalizzati x{{count}}"},"action_type_7":{"one":"personalizzato","other":"personalizzati x{{count}}"},"action_type_8":{"one":"spam","other":"spam x{{count}}"}}},"groups":{"primary":"Gruppo Primario","no_primary":"(nessun gruppo primario)","title":"Gruppi","edit":"Modifica Gruppi","refresh":"Aggiorna","new":"Nuovo","selector_placeholder":"aggiungi utenti","name_placeholder":"Nome del gruppo, senza spazi, stesse regole del nome utente","about":"Modifica qui la tua appartenenza ai gruppi e i loro nomi","group_members":"Membri del gruppo","delete":"Cancella","delete_confirm":"Cancellare questo gruppo?","delete_failed":"Impossibile cancellare il gruppo. Se questo è un gruppo automatico, non può essere eliminato."},"api":{"generate_master":"Genera una Master API Key","none":"Non ci sono chiavi API attive al momento.","user":"Utente","title":"API","key":"Chiave API","generate":"Genera","regenerate":"Rigenera","revoke":"Revoca","confirm_regen":"Sei sicuro di voler sostituire la API Key con una nuova?","confirm_revoke":"Sei sicuro di revocare la chiave?","info_html":"La tua chiave API ti permetterà di creare e aggiornare gli argomenti usando chiamate JSON.","all_users":"Tutti gli Utenti"},"backups":{"title":"Backup","menu":{"backups":"Backup","logs":"Log"},"none":"Nessun backup disponibile.","read_only":{"enable":{"title":"Abilita modalità sola lettura","text":"Abilita modalità sola lettura","confirm":"Sicuro di voler attivare la modalità di sola lettura?"},"disable":{"title":"Disattiva la modalità di sola lettura","text":"Disattiva la modalità di sola lettura"}},"logs":{"none":"Nessun log al momento..."},"columns":{"filename":"Nome del file","size":"Dimensione"},"upload":{"text":"CARICA","uploading":"CARICAMENTO","success":"'{{filename}}' è stato caricato con successo.","error":"Si è verificato un errore durante il caricamento {{filename}}': {{message}}"},"operations":{"is_running":"Un'operazione è attualmente in esecuzione...","failed":"{{operation}} non è riuscito/a. Controlla i log per saperne di più.","cancel":{"text":"Annulla","title":"Annulla l'operazione in corso","confirm":"Sei sicuro di voler annullare l'operazione corrente?"},"backup":{"text":"Backup","title":"Crea un backup","confirm":"Vuoi creare un nuovo backup?","without_uploads":"Sì (senza caricamento)"},"download":{"text":"Download","title":"Scarica il backup"},"destroy":{"text":"Cancella","title":"Rimuovi il backup","confirm":"Sicuro di voler distruggere questo backup?"},"restore":{"is_disabled":"Il ripristino è disabilitato nelle opzioni del sito.","text":"Ripristina","title":"Ripristina il backup","confirm":"Sicuro di voler ripristinare questo backup?"},"rollback":{"text":"Annulla tutto","title":"Ripristina il database a una versione funzionante precedente","confirm":"Sicuro di voler ripristinare una precedente versione funzionante del database?"}}},"export_csv":{"users":{"text":"Esporta Utenti","title":"Esporta la lista utenti in un file CSV."},"success":"L'esportazione è stata avviata. Sarai notificato a breve con il progresso del processo.","failed":"Esportazione fallita. Controlla i log."},"customize":{"title":"Personalizza","long_title":"Personalizzazioni Sito","header":"Intestazione","css":"Foglio di stile","mobile_header":"Intestazione Mobile","mobile_css":"Foglio di stile Mobile","override_default":"Non includere fogli di stile standard","enabled":"Attivo?","preview":"anteprima","undo_preview":"rimuovi anteprima","rescue_preview":"stile default","explain_preview":"Visualizza il sito con questo foglio di stile personalizzato","explain_undo_preview":"Torna al foglio di stile personalizzato attualmente attivo.","explain_rescue_preview":"Visualizza il sito con il foglio di stile predefinito","save":"Salva","new":"Nuovo","new_style":"Nuovo Stile","delete":"Cancella","delete_confirm":"Cancella questa personalizzazione?","about":"Modifica i fogli di stile CSS e le intestazioni HTML del sito. Aggiungi una personalizzazione per iniziare.","color":"Colore","opacity":"Opacità","copy":"Copia","css_html":{"title":"CSS/HTML","long_title":"Personalizzazioni CSS e HTML"},"colors":{"title":"Colori","long_title":"Combinazioni Colori","about":"Modifica i colori utilizzati sul sito senza scrivere CSS. Aggiungi una combinazione per iniziare.","new_name":"Nuova Combinazione Colori","copy_name_prefix":"Copia di","delete_confirm":"Eliminare questa combinazione di colori?","undo":"annulla","undo_title":"Annulla le modifiche effettuate a questo colore dall'ultimo salvataggio.","revert":"ripristina","revert_title":"Reimposta questo colore alla combinazione colori di default di Discourse.","primary":{"name":"primario","description":"Per la maggior parte del testo, icone e bordi."},"secondary":{"name":"secondario","description":"Il colore di sfondo principale e il colore del testo di alcuni pulsanti"},"tertiary":{"name":"terziario","description":"Colore dei collegamenti, alcuni pulsanti, notifiche e evidenziati."},"quaternary":{"name":"quaternario","description":"Collegamenti di navigazione."},"header_background":{"name":"sfondo intestazione","description":"Colore di sfondo dell'intestazione del sito."},"header_primary":{"name":"intestazione primaria","description":"Testo e icone dell'intestazione del sito."},"highlight":{"name":"evidenzia","description":"Il colore di sfondo degli elementi evidenziati nella pagina, come messaggi e argomenti."},"danger":{"name":"pericolo","description":"Colore per evidenzare azioni come la cancellazione di messaggi e argomenti."},"success":{"name":"successo","description":"Utilizzato per indicare che un'azione è stata completata con successo."},"love":{"name":"mi piace","description":"Il colore del bottone \"mi piace\"."}}},"email":{"title":"Email","settings":"Impostazioni","all":"Tutto","sending_test":"Invio email di prova in corso...","test_error":"C'è stato un problema nell'invio dell'email di test. Controlla nuovamente le impostazioni email, verifica che il tuo host non blocchi le connessioni email e riprova.","sent":"Inviato","skipped":"Saltato","sent_at":"Inviato Alle","time":"Ora","user":"Utente","email_type":"Tipo di Email","to_address":"All'indirizzo","test_email_address":"indirizzo email da testare","send_test":"Invia una email di prova","sent_test":"inviata!","delivery_method":"Metodo di consegna","preview_digest":"Anteprima Riassunto","preview_digest_desc":"Questo è uno strumento per vedere un'anteprima del contenuto delle email di riassunto inviate dal tuo forum.","refresh":"Aggiorna","format":"Formato","html":"html","text":"testo","last_seen_user":"Ultimo Utente Visto:","reply_key":"Chiave di risposta","skipped_reason":"Motivo Omissione","logs":{"none":"Nessun log trovato.","filters":{"title":"Filtro","user_placeholder":"nome utente","address_placeholder":"nome@esempio.com","type_placeholder":"riassunto, iscrizione...","skipped_reason_placeholder":"motivo"}}},"logs":{"title":"Log","action":"Azione","created_at":"Creato","last_match_at":"Ultima corrispondenza","match_count":"Corrispondenze","ip_address":"IP","delete":"Cancella","edit":"Modifica","save":"Salva","screened_actions":{"block":"blocca","do_nothing":"non fare nulla"},"staff_actions":{"title":"Azioni Staff","instructions":"Clicca sui nomi degli utenti e sulle azioni per filtrare la lista. Clicca sugli avatar per andare alle pagine degli utenti.","clear_filters":"Mostra Tutto","staff_user":"Membro dello staff","target_user":"Destinatario","subject":"Soggetto","when":"Quando","context":"Contesto","details":"Dettagli","previous_value":"Precedente","new_value":"Nuovo","diff":"Diff","show":"Mostra","modal_title":"Dettagli","no_previous":"Non c'è un valore precedente.","deleted":"Nessun nuovo valore. Il registro è stato cancellato.","actions":{"delete_user":"cancella l'utente","change_trust_level":"cambia livello attendibilità","change_site_setting":"modifica le impostazioni del sito","change_site_customization":"modifica la personalizzazione del sito","delete_site_customization":"cancella la personalizzazione del sito","suspend_user":"utente sospeso","unsuspend_user":"utente riattivato","grant_badge":"assegna targhetta","revoke_badge":"revoca targhetta"}},"screened_emails":{"title":"Email Scansionate","description":"Quando qualcuno cerca di creare un nuovo account, verrando controllati i seguenti indirizzi email  e la registrazione viene bloccata, o eseguita qualche altra azione.","email":"Indirizzo email","actions":{"allow":"Permetti"}},"screened_urls":{"title":"URL scansionati","description":"I seguenti URL sono stati usati in messaggi da utenti identificati come spammer.","url":"URL","domain":"Dominio"},"screened_ips":{"title":"IP scansionati","description":"Gli indirizzi IP che sono sotto controllo. Usa \"Permetti\" per inserirli nella lista bianca.","delete_confirm":"Davvero vuoi rimuovere la regola per %{ip_address}?","actions":{"block":"Blocca","do_nothing":"Permetti"},"form":{"label":"Nuovo:","ip_address":"Indirizzo IP","add":"Aggiungi"}},"logster":{"title":"Log Errori"}},"users":{"title":"Utenti","create":"Aggiungi Utente Amministratore","last_emailed":"Ultima email inviata","not_found":"Spiacenti, questo nome utente non esiste nel sistema.","active":"Attivo","nav":{"new":"Nuovi","active":"Attivi","pending":"In attesa","admins":"Amministratori","moderators":"Moderatori","suspended":"Sospesi","blocked":"Bloccati"},"approved":"Approvato?","approved_selected":{"one":"approva l'utente","other":"approva gli utenti ({{count}})"},"reject_selected":{"one":"rifiuta l'utente","other":"rifiuta utenti ({{count}})"},"titles":{"active":"Utenti Attivi","new":"Nuovi Utenti","pending":"Revisione degli utenti in sospeso","newuser":"Utenti con Livello Attendibilità 0 (Nuovo Utente)","basic":"Utenti con Livello Attendibilità 1 (Utente Base)","regular":"Utenti con Livello Attendibilità 2 (Utente Abituale)","elder":"Utenti con Livello Attendibilità 4 (Veterano)","admins":"Utenti Amministratori","moderators":"Moderatori","blocked":"Utenti Bloccati","suspended":"Utenti Sospesi"},"reject_successful":{"one":"1 utente rifiutato.","other":"%{count} utenti rifiutati."},"reject_failures":{"one":"Impossibile rifiutare 1 utente","other":"Impossibile rifiutare %{count} utenti."}},"user":{"suspend_failed":"Si è verificato un errore sospendendo questo utente {{error}}","unsuspend_failed":"Si è verificato un errore riabilitando questo utente {{error}}","suspend_duration":"Per quanto tempo l'utente sarà sospeso?","suspend_duration_units":"(giorni)","suspend_reason_label":"Perché lo stai sospendendo? Questo testo \u003cb\u003esarà visibile a tutti\u003c/b\u003e nella pagina del profilo dell'utente, e gli verrà mostrato tutte le volte che effettuerà il login. Scrivi il meno possibile.","suspend_reason":"Motivo","suspended_by":"Sospeso da","delete_all_posts":"Cancella tutti i messaggi","delete_all_posts_confirm":"Stai per cancellare %{posts} messaggi e %{topics} argomenti. Sei sicuro?","suspend":"Sospendi","unsuspend":"Riabilita","suspended":"Sospeso?","moderator":"Moderatore?","admin":"Amministratore?","blocked":"Bloccato?","show_admin_profile":"Amministratore","edit_title":"Modifica Titolo","save_title":"Salva Titolo","refresh_browsers":"Forza l'aggiornamento del browser","refresh_browsers_message":"Messaggio inviato a tutti i client!","show_public_profile":"Mostra Profilo Pubblico","impersonate":"Impersona","ip_lookup":"IP Lookup","log_out":"Disconnetti","logged_out":"L'utente è stato disconnesso da tutti i terminali","revoke_admin":"Revoca privilegi di amministrazione","grant_admin":"Assegna privilegi di amministrazione","revoke_moderation":"Revoca privilegi di moderazione","grant_moderation":"Assegna diritti di moderazione","unblock":"Sblocca","block":"Blocca","reputation":"Reputazione","permissions":"Permessi","activity":"Attività","like_count":"\"Mi piace\" Assegnati / Ricevuti","last_100_days":"negli ultimi 100 giorni","private_topics_count":"Argomenti Privati","posts_read_count":"Messaggi Letti","post_count":"Messaggi Creati","topics_entered":"Argomenti Visti","flags_given_count":"Segnalazioni Fatte","flags_received_count":"Segnalazioni Ricevute","flags_given_received_count":"Segnalazioni Fatte / Ricevute","approve":"Approva","approved_by":"approvato da","approve_success":"Utente approvato ed email inviata con istruzioni di attivazione.","approve_bulk_success":"Riuscito! Tutti gli utenti selezionati sono stati approvati e notificati.","time_read":"Tempo di lettura","delete":"Cancella utente","delete_forbidden_because_staff":"Amministratori e moderatori non possono essere cancellati.","delete_forbidden":{"one":"Non è possibile cancellare utenti se hanno post attivi. Elimina tutti i posti prima di cancellare un utente (post più vecchi di %{count} giorni non possono essere cancellati).","other":"Non è possibile cancellare utenti se hanno messaggi. Elimina tutti i messaggi prima di cancellare un utente (i messaggi più vecchi di %{count} giorni non possono essere cancellati)."},"cant_delete_all_posts":{"one":"Non posso cancellare tutti i post. Alcuni sono più vecchi di %{count} giorno. (L'impostazione delete_user_max_post_age.)","other":"Impossibile cancellare tutti i messaggi. Alcuni sono più vecchi di %{count} giorni. (L'impostazione delete_user_max_post_age.)"},"cant_delete_all_too_many_posts":{"one":"Non posso cancellare tutti i post perché l'utente ha più di 1 post. (delete_all_posts_max.)","other":"Impossibile cancellare tutti i messaggi perché l'utente ha più di %{count} messaggi. (delete_all_posts_max.)"},"delete_confirm":"Sei SICURO di voler eliminare questo utente? Non è possibile annullare!","delete_and_block":"Elimina e \u003cb\u003eblocca\u003c/b\u003e questa email e indirizzo IP","delete_dont_block":"Elimina soltanto","deleted":"L'utente è stato cancellato.","delete_failed":"Si è verificato un errore nella cancellazione dell'utente. Assicurati che tutti i messaggi siano stati cancellati prima di provare a cancellare l'utente.","send_activation_email":"Invia Email Attivazione","activation_email_sent":"Un'email di attivazione è stata inviata.","send_activation_email_failed":"Si è verificato un errore nell'invio di un'altra email di attivazione. %{error}","activate":"Attiva Account","activate_failed":"Si è verificato un problema nell'attivazione dell'utente.","deactivate_account":"Disattiva Account","deactivate_failed":"Si è verificato un errore durante la disattivazione dell'utente.","unblock_failed":"Si è verificato un errore durante lo sblocco dell'utente.","block_failed":"Si è verificato un errore durante il blocco dell'utente.","deactivate_explanation":"Un utente disattivato deve riconvalidare la propria email.","suspended_explanation":"Un utente sospeso non può fare il login.","block_explanation":"Un utente bloccato non può pubblicare messaggi o iniziare argomenti.","trust_level_change_failed":"C'è stato un problema nel cambio di livello di attendibilità di questo utente.  ","suspend_modal_title":"Sospendi Utente","trust_level_2_users":"Utenti con Livello Attendibilità 2","trust_level_3_requirements":"Requisiti per Livello Attendibilità 3","tl3_requirements":{"title":"Requisiti per Livello Attendibilità 3","table_title":"Negli ultimi 100 giorni:","value_heading":"Valore","requirement_heading":"Requisito","visits":"Visite","days":"giorni","topics_replied_to":"Argomenti Risposti A","topics_viewed":"Argomenti Visualizzati","topics_viewed_all_time":"Argomenti Visualizzati (di sempre)","posts_read":"Messaggi Letti","posts_read_all_time":"Messaggi Letti (di sempre)","flagged_posts":"Messaggi Segnalati","flagged_by_users":"Utenti Segnalatori","likes_given":"Mi piace - Assegnati","likes_received":"Mi piace - Ricevuti","qualifies":"Requisiti per Livello Attendibilità 3.","will_be_promoted":"Verrà promosso entro 24 ore.","does_not_qualify":"Non ha i requisiti per il Livello Attendibilità 3."},"sso":{"title":"Single Sign On","external_id":"ID Esterno","external_username":"Nome utente","external_name":"Nome","external_email":"Email","external_avatar_url":"URL dell'Avatar"}},"site_content":{"none":"Scegli un tipo di contenuto per iniziare a scrivere.","title":"Contenuto","edit":"Modifica Contenuto Sito"},"site_settings":{"show_overriden":"Mostra solo i sovrascritti","title":"Impostazioni","reset":"reimposta","none":"nessuno","no_results":"Nessun risultato trovato.","clear_filter":"Pulisci","categories":{"all_results":"Tutti","required":"Obbligatorio","basic":"Impostazioni Base","users":"Utenti","posting":"Pubblicazione","email":"Email","files":"File","trust":"Livelli Attendibilità","security":"Sicurezza","onebox":"Onebox","seo":"SEO","spam":"Spam","rate_limits":"Limiti Frequenza","developer":"Sviluppatore","embedding":"Incorporo","legal":"Legale","uncategorized":"Altro","backups":"Backup","login":"Accedi"}},"badges":{"title":"Targhette","new_badge":"Nuova Targhetta","new":"Nuovo","name":"Nome","badge":"Targhetta","display_name":"Nome Visualizzato","description":"Descrizione","badge_type":"Tipo Targhetta","badge_grouping":"Gruppo","badge_groupings":{"modal_title":"Raggruppamento Targhette"},"granted_by":"Assegnata Da","granted_at":"Assegnata in data","save":"Salva","delete":"Cancella","delete_confirm":"Sei sicuro di voler cancellare questa targhetta?","revoke":"Revoca","revoke_confirm":"Sei sicuro di voler revocare questa targhetta?","edit_badges":"Modifica Targhette","grant_badge":"Assegna Targhetta","granted_badges":"Targhette Assegnate","grant":"Assegna","no_user_badges":"%{name} non ha ricevuto alcuna targhetta.","no_badges":"Non ci sono targhette da assegnare.","allow_title":"Permetti di utilizzare le targhette come titoli","multiple_grant":"Può essere assegnata più volte","listable":"Mostra targhetta sulla pagina pubblica delle targhette","enabled":"Attiva targhetta","icon":"Icona","query":"Badge Query (SQL)","target_posts":"Interroga i messaggi destinazione","auto_revoke":"Avvia l'istruzione di revoca giornalmente","show_posts":"Visualizza i messaggi che assegnano le targhette sulla pagina delle targhette","trigger":"Trigger","trigger_type":{"none":"Aggiorna giornalmente","post_action":"Quando un utente agisce su un messaggio","post_revision":"Quando un utente modifica o crea un messaggio","trust_level_change":"Quando un utente cambia livello di attendibilità","user_change":"Quando un utente viene modificato o creato"}}},"lightbox":{"download":"scaricamento"},"keyboard_shortcuts_help":{"title":"Scorciatoie da tastiera","jump_to":{"title":"Vai A","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e Home (Ultimi)","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e Ultimi","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e Nuovi","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e Non Letti","starred":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ef\u003c/b\u003e Preferiti","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Categorie"},"navigation":{"title":"Navigazione","jump":"\u003cb\u003e#\u003c/b\u003e Va al messaggio numero","back":"\u003cb\u003eu\u003c/b\u003e Indietro","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Sposta la selezione su/giù","open":"\u003cb\u003eo\u003c/b\u003e o \u003cb\u003eInvio\u003c/b\u003e Apre l'argomento selezionato"},"application":{"title":"Applicazione","create":"\u003cb\u003ec\u003c/b\u003e Crea un nuovo argomento","notifications":"\u003cb\u003en\u003c/b\u003e Apre le notifiche","site_map_menu":"\u003cb\u003e=\u003c/b\u003e Apri il menu: mappa del sito","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e Apre il menu del profilo utente","search":"\u003cb\u003e/\u003c/b\u003e Cerca","help":"\u003cb\u003e?\u003c/b\u003e Apre l'aiuto per le scorciatoie da tastiera"},"actions":{"title":"Azioni","star":"\u003cb\u003ef\u003c/b\u003e Metti l'argomento nei preferiti","share_topic":"\u003cb\u003eshift s\u003c/b\u003e Condividi argomento","share_post":"\u003cb\u003es\u003c/b\u003e Condividi messaggio","reply_topic":"\u003cb\u003eshift r\u003c/b\u003e Rispondi all'argomento","reply_post":"\u003cb\u003er\u003c/b\u003e Rispondi al messaggio","quote_post":"\u003cb\u003eq\u003c/b\u003e Cita messaggio","like":"\u003cb\u003el\u003c/b\u003e Metti \"Mi piace\" al messaggio","flag":"\u003cb\u003e!\u003c/b\u003e Segnala il messaggio","bookmark":"\u003cb\u003eb\u003c/b\u003e Aggiungi un segnalibro al messaggio","edit":"\u003cb\u003ee\u003c/b\u003e Modifica il messaggio","delete":"\u003cb\u003ed\u003c/b\u003e Cancella il messaggio","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Ignora argomento","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Ripristina (default) argomento","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Segui argomento","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e Osserva argomento"}},"badges":{"title":"Targhette","allow_title":"permetti targhetta come titolo?","multiple_grant":"assegnata più volte?","badge_count":{"one":"1 Targhetta","other":"%{count} Targhette"},"more_badges":{"one":"+1 Più","other":"+%{count} Più"},"granted":{"one":"1 assegnato","other":"%{count} assegnate"},"select_badge_for_title":"Scegli una targhetta da usare come tuo titolo","no_title":"\u003cno title\u003e","badge_grouping":{"getting_started":{"name":"Per Iniziare"},"community":{"name":"Comunità"},"trust_level":{"name":"Livello Attendibilità"},"other":{"name":"Altro"},"posting":{"name":"Pubblicazione"}},"badge":{"editor":{"name":"Editor","description":"Prima modifica ad un messaggio"},"basic_user":{"name":"Base","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/4\"\u003eAssegnate\u003c/a\u003e tutte le funzioni essenziali della comunità"},"regular_user":{"name":"Normale","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/5\"\u003eAssegnata\u003c/a\u003e inviti"},"leader":{"name":"Leader","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/6\"\u003eAssegnata\u003c/a\u003e ricategorizza, rinomina, collegamenti seguiti e lounge"},"elder":{"name":"Veterano","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/7\"\u003eAssegnata\u003c/a\u003e capacità globale di modifica, evidenzare, chiudere, archiviare, dividere e unire"},"welcome":{"name":"Benvenuto","description":"Ricevuto un \"Mi piace\""},"autobiographer":{"name":"Autobiografo","description":"Hai completato le informazioni del tuo \u003ca href=\"/my/preferences\"\u003eprofilo\u003c/a\u003e utente"},"nice_post":{"name":"Buon Messaggio","description":"Ha ricevuto 10 \"mi piace\" in un messaggio. Questa targhetta può essere assegnata più volte."},"good_post":{"name":"Ottimo Messaggio","description":"Ha ricevuto 25 \"mi piace\" in un messaggio. Questa targhetta può essere assegnata più volte."},"great_post":{"name":"Fantastico Messaggio","description":"Ha ricevuto 50 \"mi piace\" in un messaggio. Questa targhetta può essere assegnata più volte."},"first_like":{"name":"Primo Mi Piace","description":"\"Mi piace\" ad un messaggio"},"first_flag":{"name":"Prima Segnalazione","description":"Ha segnalato un messaggio"},"first_share":{"name":"Prima Condivisione","description":"Ha condiviso un messaggio"},"first_link":{"name":"Primo Collegamento","description":"Ha aggiunto un collegamento interno ad un altro argomento"},"first_quote":{"name":"Prima Citazione","description":"Ha citato un utente"},"read_guidelines":{"name":"Leggi le Linee Guida","description":"Leggi le \u003ca href=\"/guidelines\"\u003elinee guida della comunità\u003c/a\u003e"},"reader":{"name":"Lettore","description":"Leggi tutti i messaggi in un argomento con più di 100 messaggi"}}}}}};
I18n.locale = 'it';
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
// locale : italian (it)
// author : Lorenzo : https://github.com/aliem
// author: Mattia Larentis: https://github.com/nostalgiaz

(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define(['moment'], factory); // AMD
    } else if (typeof exports === 'object') {
        module.exports = factory(require('../moment')); // Node
    } else {
        factory(window.moment); // Browser global
    }
}(function (moment) {
    return moment.defineLocale('it', {
        months : "gennaio_febbraio_marzo_aprile_maggio_giugno_luglio_agosto_settembre_ottobre_novembre_dicembre".split("_"),
        monthsShort : "gen_feb_mar_apr_mag_giu_lug_ago_set_ott_nov_dic".split("_"),
        weekdays : "Domenica_Lunedì_Martedì_Mercoledì_Giovedì_Venerdì_Sabato".split("_"),
        weekdaysShort : "Dom_Lun_Mar_Mer_Gio_Ven_Sab".split("_"),
        weekdaysMin : "D_L_Ma_Me_G_V_S".split("_"),
        longDateFormat : {
            LT : "HH:mm",
            L : "DD/MM/YYYY",
            LL : "D MMMM YYYY",
            LLL : "D MMMM YYYY LT",
            LLLL : "dddd, D MMMM YYYY LT"
        },
        calendar : {
            sameDay: '[Oggi alle] LT',
            nextDay: '[Domani alle] LT',
            nextWeek: 'dddd [alle] LT',
            lastDay: '[Ieri alle] LT',
            lastWeek: '[lo scorso] dddd [alle] LT',
            sameElse: 'L'
        },
        relativeTime : {
            future : function (s) {
                return ((/^[0-9].+$/).test(s) ? "tra" : "in") + " " + s;
            },
            past : "%s fa",
            s : "alcuni secondi",
            m : "un minuto",
            mm : "%d minuti",
            h : "un'ora",
            hh : "%d ore",
            d : "un giorno",
            dd : "%d giorni",
            M : "un mese",
            MM : "%d mesi",
            y : "un anno",
            yy : "%d anni"
        },
        ordinal: '%dº',
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });
}));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('MMMM D, YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
