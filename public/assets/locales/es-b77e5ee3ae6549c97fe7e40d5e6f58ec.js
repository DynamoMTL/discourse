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
MessageFormat.locale.es = function ( n ) {
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
r += "Hay ";
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
r += "<a href='/unread'>1 no leído</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "<a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " no leídos</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "y ";
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
r += " <a href='/new'>1 nuevo</a> topic";
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
})() + " nuevos</a> topics";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " restantes, o ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "explora otros temas en ";
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
r += "Este tema tiene ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 post";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " posts";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "con una ratio de me gusta por post elevada";
return r;
},
"med" : function(d){
var r = "";
r += "con una ratio de me gusta por post bastante elevada";
return r;
},
"high" : function(d){
var r = "";
r += "con una ratio de me gusta por post elevadísima";
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
}});I18n.translations = {"es":{"js":{"number":{"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}}},"dates":{"time":"h:mm a","long_no_year":"MMM D h:mm a","long_no_year_no_time":"MMM D","long_with_year":"MMM D, YYYY h:mm a","long_with_year_no_time":"MMM D, YYYY","long_date_with_year":"D MMM, 'YY LT","long_date_without_year":"D MMM, LT","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c 1s","other":"\u003c %{count}s"},"x_seconds":{"one":"1s","other":"%{count}s"},"less_than_x_minutes":{"one":"\u003c 1m","other":"\u003c %{count}m"},"x_minutes":{"one":"1m","other":"%{count}m"},"about_x_hours":{"one":"1h","other":"%{count}h"},"x_days":{"one":"1d","other":"%{count}d"},"about_x_years":{"one":"1a","other":"%{count}a"},"over_x_years":{"one":"\u003e 1a","other":"\u003e %{count}a"},"almost_x_years":{"one":"1a","other":"%{count}a"},"date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"1 minuto","other":"%{count} mins"},"x_hours":{"one":"1 hora","other":"%{count} horas"},"x_days":{"one":"1 día","other":"%{count} días"}},"medium_with_ago":{"x_minutes":{"one":"hace 1 minuto","other":"hace %{count} minutos"},"x_hours":{"one":"hace 1 hora","other":"hace %{count} horas"},"x_days":{"one":"hace 1 día","other":"hace %{count} días"}}},"share":{"topic":"comparte un enlace a este tema","post":"comparte un enlace al post #%{postNumber}","close":"cerrar","twitter":"comparte este enlace en Twitter","facebook":"comparte este enlace en Facebook","google+":"comparte este enlace en Google+","email":"comparte este enlace por email"},"edit":"editar el título y la categoría de este tema","not_implemented":"Esta característica no ha sido implementada aún, ¡lo sentimos!","no_value":"No","yes_value":"Sí","generic_error":"Lo sentimos, ha ocurrido un error.","generic_error_with_reason":"Ha ocurrido un error: %{error}","sign_up":"Registrarse","log_in":"Iniciar sesión","age":"Edad","joined":"Unido","admin_title":"Admin","flags_title":"Reportes","show_more":"ver más","links":"Enlaces","links_lowercase":"Enlaces","faq":"FAQ","guidelines":"Directrices","privacy_policy":"Política de privacidad","privacy":"Privacidad","terms_of_service":"Condiciones Generales de Uso","mobile_view":"Versión móvil","desktop_view":"Versión de escritorio","you":"Tú","or":"o","now":"ahora mismo","read_more":"leer más","more":"Más","less":"Menos","never":"nunca","daily":"cada día","weekly":"cada semana","every_two_weeks":"cada dos semanas","max":"máximo","character_count":{"one":"{{count}} carácter","other":"{{count}} caracteres"},"in_n_seconds":{"one":"en 1 segundo","other":"en {{count}} segundo"},"in_n_minutes":{"one":"en 1 minuto","other":"en {{count}} minuto"},"in_n_hours":{"one":"en 1 hora","other":"en {{count}} horas"},"in_n_days":{"one":"en 1 día","other":"en {{count}} días"},"suggested_topics":{"title":"Temas sugeridos"},"about":{"simple_title":"Acerca de","title":"Sobre %{title}","stats":"Estadísticas del sitio","our_admins":"Nuestros Administradores","our_moderators":"Nuestros Moderadores","stat":{"all_time":"Todo el tiempo","last_7_days":"Últimos 7 días"},"like_count":"Número de 'me gusta'","topic_count":"Número de temas","post_count":"Número de posts","user_count":"Número de usuarios"},"bookmarks":{"not_logged_in":"Lo sentimos, debes iniciar sesión para guardar posts en marcadores.","created":"has marcado este post como favorito","not_bookmarked":"has leído este post, haz clic para marcarlo como favorito","last_read":"este es el último post que has leído; haz clic para marcarlo como favorito","remove":"Eliminar marcador"},"topic_count_latest":{"one":"Un tema nuevo o actualizado.","other":"{{count}} temas nuevos o actualizados."},"topic_count_unread":{"one":"Un tema sin leer.","other":"{{count}} temas sin leer."},"topic_count_new":{"one":"Un nuevo tema.","other":"{{count}} nuevos temas."},"click_to_show":"Click para mostrar.","preview":"vista previa","cancel":"cancelar","save":"Guardar cambios","saving":"Guardando...","saved":"¡Guardado!","upload":"Subir","uploading":"Subiendo...","uploaded":"Subido!","enable":"Activar","disable":"Desactivar","undo":"Deshacer","revert":"Revertir","banner":{"close":"Eliminar este encabezado. "},"choose_topic":{"none_found":"Ningún tema encontrado.","title":{"search":"Buscar un Tema por nombre, url o id:","placeholder":"escribe el título de tema aquí"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e publicó \u003ca href='{{topicUrl}}'\u003eel tema\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eTú\u003c/a\u003e publicaste \u003ca href='{{topicUrl}}'\u003eel tema\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e contestó a \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eTú\u003c/a\u003e contestaste a \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e contestó a \u003ca href='{{topicUrl}}'\u003eel tema\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eTú\u003c/a\u003e contestaste \u003ca href='{{topicUrl}}'\u003eel tema\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e mencionó a \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e \u003ca href='{{user2Url}}'\u003ete\u003c/a\u003e mencionó","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eTú\u003c/a\u003e mencionaste a \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Publicado por \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Publicado por \u003ca href='{{userUrl}}'\u003eti\u003c/a\u003e","sent_by_user":"Enviado por \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Enviado por \u003ca href='{{userUrl}}'\u003eti\u003c/a\u003e"},"groups":{"visible":"El grupo es visible para todos los usuarios","title":{"one":"grupo","other":"grupos"},"members":"Miembros","posts":"Posts","alias_levels":{"title":"¿Quién puede usar este grupo como un alias?","nobody":"Nadie","only_admins":"Solo administradores","mods_and_admins":"Solo moderadores y administradores","members_mods_and_admins":"Solo miembros del grupo, moderadores y administradores","everyone":"Todos"}},"user_action_groups":{"1":"Likes dados","2":"Likes recibidos","3":"Marcadores","4":"Temas","5":"Posts","6":"Respuestas","7":"Menciones","9":"Citas","10":"Favoritos","11":"Ediciones","12":"Items enviados","13":"Bandeja de entrada"},"categories":{"all":"Todas las categorías","all_subcategories":"todas","no_subcategory":"ninguna","category":"Categoría","posts":"Posts","topics":"Temas","latest":"Recientes","latest_by":"recientes por","toggle_ordering":"activar orden","subcategories":"Subcategorías","topic_stats":"El número de temas nuevos.","topic_stat_sentence":{"one":"%{count} tema nuevo en los últimos %{unit}.","other":"%{count} temas nuevos en los últimos %{unit}."},"post_stats":"Número de comentarios nuevos","post_stat_sentence":{"one":"%{count} nuevo comentario en los pasados %{unit}","other":"%{count} nuevos comentarios en los pasados %{unit}"}},"ip_lookup":{"title":"Búsqueda de Direcciones IP","hostname":"nombre del host","location":"Ubicación","location_not_found":"(desconocido)","organisation":"Organización","phone":"Teléfono","other_accounts":"Otras cuentas con esta dirección IP","no_other_accounts":"(ninguna)"},"user":{"said":"{{username}} dice:","profile":"Perfil","mute":"Silenciar","edit":"Editar Preferencias","download_archive":"descargar un archivo con mis publicaciones","private_message":"Mensaje privado","private_messages":"Mensajes","activity_stream":"Actividad","preferences":"Preferencias","bookmarks":"Marcadores","bio":"Acerca de mí","invited_by":"Invitado por","trust_level":"Nivel de confianza","notifications":"Notificaciones","disable_jump_reply":"No ir directamente a tu nuevo post al responder","dynamic_favicon":"Mostrar notificaciones de mensajes de entrada en favicon (experimental)","edit_history_public":"Dejar que otros usuarios puedan ver las revisiones de mis posts","external_links_in_new_tab":"Abrir todos los links externos en una nueva pestaña","enable_quoting":"Activar respuesta citando el texto resaltado","change":"cambio","moderator":"{{user} es un moderador","admin":"{{user}} es un administrador","moderator_tooltip":"Este usuario es moderador","admin_tooltip":"Este usuario es administrador","suspended_notice":"Este usuario ha sido suspendido hasta {{date}}.","suspended_reason":"Causa: ","watched_categories":"Vigiladas","watched_categories_instructions":"Automáticamente vigilarás todos los temas en estas categorías. Se te notificará de todos los posts y temas, y además aparecerá un contador de posts nuevos y no leídos en la lista de temas.","tracked_categories":"Siguiendo","tracked_categories_instructions":"Automáticamente seguirás todos los nuevos temas en estas categorías. Aparecerá un contador de posts no leídos y posts nuevos en la lista de temas.","muted_categories":"Silenciar","muted_categories_instructions":"No recibirá notificaciones sobre ningún tema nuevo en esta categoría, y no aparecerán en la sección de \"no leídos\".","delete_account":"Borrar mi cuenta","delete_account_confirm":"Estás seguro que quieres borrar permanentemente tu cuenta? Esta acción no puede ser deshecho!","deleted_yourself":"Tu cuenta ha sido borrado con exito.","delete_yourself_not_allowed":"No puedes borrar tu cuenta en este momento. Contacta un administrador para borrar tu cuenta en tu nombre.","unread_message_count":"Mensajes","staff_counters":{"flags_given":"reportes útiles emitidos","flagged_posts":"posts reportados","deleted_posts":"posts eliminados","suspensions":"suspensiones"},"messages":{"all":"Todos","mine":"Míos","unread":"No leídos"},"change_password":{"success":"(email enviado)","in_progress":"(enviando email)","error":"(error)","action":"Enviar email para resetear la contraseña","set_password":"Establecer contraseña"},"change_about":{"title":"Cambiar 'Acerca de mí'"},"change_username":{"title":"Cambiar nombre de usuario","confirm":"Si cambias tu nombre de usuario, todas las citas de tus publicaciones y tus menciones desaparecerán. ¿Estás totalmente seguro de querer cambiarlo?","taken":"Lo sentimos, pero este nombre de usuario ya está cogido","error":"Ha ocurrido un error al cambiar tu nombre de usuario.","invalid":"Este nombre de usuario no es válido. Debe incluir sólo números y letras"},"change_email":{"title":"Cambiar Email","taken":"Lo sentimos, pero este email no está disponible.","error":"Ha ocurrido un error al cambiar tu email. ¿Tal vez esa dirección ya está en uso?","success":"Te hemos enviado un email a esa dirección. Por favor sigue las instrucciones de confirmación."},"change_avatar":{"title":"Cambiar tu avatar","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, basado en","refresh_gravatar_title":"Actualizar tu Gravatar","letter_based":"Avatar asignado por el sistema","uploaded_avatar":"Foto personalizada","uploaded_avatar_empty":"Añade una foto personalizada","upload_title":"Sube tu foto","upload_picture":"Subir imagen","image_is_not_a_square":"Peligro: hemos recortado su foto; no es cuadrada."},"change_profile_background":{"title":"Fondo de perfil"},"email":{"title":"Email","instructions":"Nunca será mostrado al público.","ok":"De acuerdo. Te enviaremos un email para confirmar.","invalid":"Por favor ingresa una dirección de email válida.","authenticated":"Tu email ha sido autenticado por {{provider}}.","frequency":"Sólo te enviaremos emails si no te hemos visto recientemente y todavía no has visto lo que te estamos enviando."},"name":{"title":"Nombre","instructions":"Tu nombre completo.","too_short":"Tu nombre es demasiado corto.","ok":"Tu nombre es válido."},"username":{"title":"Nombre de usuario","instructions":"Debe ser único, conciso y sin espacios.","short_instructions":"La gente puede mencionarte como @{{username}}.","available":"Tu nombre de usuario está disponible.","global_match":"El email coincide con el nombre de usuario registrado.","global_mismatch":"Ya está registrado. Intenta {{suggestion}}?","not_available":"No disponible. Intenta {{suggestion}}?","too_short":"Tu nombre de usuario es demasiado corto.","too_long":"Tu nombre de usuario es demasiado largo.","checking":"Comprobando disponibilidad de nombre de usuario...","enter_email":"Nombre de usuario encontrado. Por favor, Introduce el email correspondiente.","prefilled":"El email coincide con el nombre de usuario registrado."},"locale":{"title":"Idioma del interfaz","default":"(por defecto)"},"password_confirmation":{"title":"Introduce de nuevo la contraseña"},"last_posted":"Último vez que publicó","last_emailed":"Último Enviado por email","last_seen":"Visto por última vez","created":"Creado el","log_out":"Cerrar sesión","location":"Ubicación","website":"Sitio Web","email_settings":"Email","email_digests":{"title":"Cuando no visite el sitio, envíenme un resumen vía email de las novedades","daily":"diariamente","weekly":"semanalmente","bi_weekly":"cada dos semanas"},"email_direct":"Quiero recibir un email cuando alguien cite, responda, o mencione tu @nombredeusuario","email_private_messages":"Quiero recibir un email cuando alguien te envíe un mensaje privado","other_settings":"Otros","categories_settings":"Categorias","new_topic_duration":{"label":"Considerar que los temas son nuevos cuando","not_viewed":"no los has visto todavía","last_here":"publicados desde la última vez que estuviste aquí","after_n_days":{"one":"publicados en el último día","other":"publicados en los últimos {{count}} días"},"after_n_weeks":{"one":"publicados en la última semana","other":"publicados en las últimas {{count}} semanas"}},"auto_track_topics":"Seguir automáticamente los temas que leo","auto_track_options":{"never":"nunca","always":"siempre","after_n_seconds":{"one":"después de 1 segundo","other":"después de {{count}} segundos"},"after_n_minutes":{"one":"después de 1 minuto","other":"después de {{count}} minutos"}},"invited":{"search":"escribe para buscar invitaciones...","title":"Invitaciones","user":"Invitar usuario","none":"No has invitado a nadie todavía.","truncated":"Mostrando las primeras {{count}} invitaciones.","redeemed":"Invitaciones aceptadas","redeemed_at":"Aceptada el","pending":"Invitaciones pendientes","topics_entered":"temas vistos","posts_read_count":"Posts leídos","expired":"Esta invitación ha vencido.","rescind":"Remover","rescinded":"Invitación eliminada","time_read":"Tiempo de lectura","days_visited":"Días visitados","account_age_days":"Antigüedad de la cuenta en días","create":"Enviar una invitación","bulk_invite":{"none":"No has invitado a nadie todavía. Puedes enviar invitaciones Puede enviar invitaciones individuales o invitar a un grupo de personas a la vez \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003esubiendo un archivo para invitaciones en masa\u003c/a\u003e.","text":"Archivo de invitación en masa","uploading":"SUBIENDO","success":"Archivo subido satisfactoriamente, se te notificará en breve con los avances.","error":"Hubo un error al subir '{{filename}}': {{message}}"}},"password":{"title":"Contraseña","too_short":"Tu contraseña es demasiado corta.","common":"Esa contraseña es demasiado común.","ok":"Tu contraseña es válida.","instructions":"Debe tener por lo menos %{count} caracteres."},"ip_address":{"title":"Última dirección IP"},"registration_ip_address":{"title":"Dirección IP de registro"},"avatar":{"title":"Avatar"},"title":{"title":"Título"},"filters":{"all":"Todos"},"stream":{"posted_by":"Publicado por","sent_by":"Enviado por","private_message":"mensaje privado","the_topic":"el tema"}},"loading":"Cargando...","errors":{"prev_page":"mientras se intentaba cargar","reasons":{"network":"Error de red","server":"Error de servidor","forbidden":"Acceso denegado","unknown":"Error"},"desc":{"network":"Por favor revisa tu conexión.","network_fixed":"Parece que ha vuelto.","server":"Código de error: {{status}}","unknown":"Algo fue mal."},"buttons":{"back":"Volver atrás","again":"Intentar de nuevo","fixed":"Cargar página"}},"close":"Cerrar","assets_changed_confirm":"Este sitio acaba de ser actualizado justo ahora. ¿Quieres recargar la página para ver la última versión?","read_only_mode":{"enabled":"Un administrador ha habilitado el modo sólo-lectura. Puedes continuar navegando por el sitio pero las interacciones podrían no funcionar.","login_disabled":"Abrir una sesión está desactivado mientras el foro este modo solo lectura."},"learn_more":"saber más...","year":"año","year_desc":"temas creados en los últimos 365 días","month":"mes","month_desc":"temas creados en los últimos 30 días","week":"semana","week_desc":"temas creados en los últimos 7 días","day":"día","first_post":"Primer post","mute":"Silenciar","unmute":"No silenciar","last_post":"Último post","last_post_lowercase":"Última publicación","summary":{"description":"Hay \u003cb\u003e{{count}}\u003c/b\u003e respuestas.","description_time":"Hay \u003cb\u003e{{count}}\u003c/b\u003e respuestas con un tiempo de lectura estimado de \u003cb\u003e{{readingTime}} minutos\u003c/b\u003e.","enable":"Resumir el tema","disable":"Ver todos los posts"},"deleted_filter":{"enabled_description":"Este tema contiene posts eliminados que han sido ocultados.","disabled_description":"Se están mostrando los posts eliminados de este tema. ","enable":"Ocultar posts eliminados","disable":"Mostrar las respuestas eliminadas"},"private_message_info":{"title":"Conversación privada","invite":"Invitar a otros...","remove_allowed_user":"¿Seguro que quieres eliminar a {{name}} de este mensaje privado?"},"email":"Email","username":"Nombre de usuario","last_seen":"Visto por última vez","created":"Creado","created_lowercase":"Creado","trust_level":"Nivel de confianza","search_hint":"usuario o email","create_account":{"title":"Crear nueva cuenta","failed":"Algo ha salido mal, tal vez este email ya fue registrado, intenta con el enlace 'olvidé la contraseña'"},"forgot_password":{"title":"Olvidé mi contraseña","action":"Olvidé mi contraseña","invite":"Introduce tu nombre de usuario o tu dirección de email, y te enviaremos un correo electrónico para cambiar tu contraseña.","reset":"Restablecer contraseña","complete_username":"Si una cuenta coincide con el nombre de usuario \u003cb\u003e%{username}\u003c/b\u003e, dentro de poco deberías recibir un email con las instrucciones para cambiar tu contraseña.","complete_email":"Si una cuenta coincide con \u003cb\u003e%{email}\u003c/b\u003e, dentro de poco deberías recibir un email con las instrucciones para cambiar tu contraseña."},"login":{"title":"Iniciar sesión","username":"Usuario","password":"Contraseña","email_placeholder":"dirección de email o nombre de usuario","caps_lock_warning":"Está activado Bloqueo de Mayúsculas","error":"Error desconocido","blank_username_or_password":"Por favor, introducir tu email o usuario y tu contraseña","reset_password":"Restablecer contraseña","logging_in":"Iniciando sesión","or":"O","authenticating":"Autenticando...","awaiting_confirmation":"Tu cuenta está pendiente de activación, usa el enlace de 'olvidé contraseña' para recibir otro email de activación.","awaiting_approval":"Tu cuenta todavía no ha sido aprobada por un moderador. Recibirás un email cuando sea aprobada.","requires_invite":"Lo sentimos pero el acceso a este foro es únicamente mediante invitación.","not_activated":"No puedes iniciar sesión todavía. Anteriormente te hemos enviado un email de activación a \u003cb\u003e{{sentTo}}\u003c/b\u003e. Por favor sigue las instrucciones en ese email para activar tu cuenta.","resend_activation_email":"Has clic aquí para enviar el email de activación nuevamente.","sent_activation_email_again":"Te hemos enviado otro email de activación a \u003cb\u003e{{currentemail}}\u003c/b\u003e. Podría tardar algunos minutos en llegar; asegúrate de revisar tu carpeta de spam.","google":{"title":"con Google","message":"Autenticando con Google (asegúrate de desactivar cualquier bloqueador de pop ups)"},"google_oauth2":{"title":"con Google","message":"Autenticando con Google (asegúrate de no tener habilitados bloqueadores de pop-up)"},"twitter":{"title":"con Twitter","message":"Autenticando con Twitter (asegúrate de desactivar cualquier bloqueador de pop ups)"},"facebook":{"title":"con Facebook","message":"Autenticando con Facebook (asegúrate de desactivar cualquier bloqueador de pop ups)"},"yahoo":{"title":"con Yahoo","message":"Autenticando con Yahoo (asegúrate de desactivar cualquier bloqueador de pop ups)"},"github":{"title":"con GitHub","message":"Autenticando con GitHub (asegúrate de desactivar cualquier bloqueador de pop ups)"}},"composer":{"posting_not_on_topic":"Estas respondiendo al tema \"{{title}}\", pero estas viendo un tema distinto.","saving_draft_tip":"guardando","saved_draft_tip":"guardado","saved_local_draft_tip":"guardado localmente","similar_topics":"Tu tema es similar a...","drafts_offline":"borradores offline","min_length":{"need_more_for_title":"{{n}} para completar el título","need_more_for_reply":"{{n}} para completar la respuesta"},"error":{"title_missing":"Es necesario un título","title_too_short":"El título debe ser por lo menos de {{min}} caracteres.","title_too_long":"El título no puede tener más de {{max}} caracteres.","post_missing":"El post no puede estar vacío.","post_length":"El post debe tener por lo menos {{min}} caracteres.","category_missing":"Debes escoger una categoría."},"save_edit":"Guardar edición","reply_original":"Responder en el tema original","reply_here":"Responder aquí","reply":"Responder","cancel":"Cancelar","create_topic":"Crear tema","create_pm":"Crear mensaje privado","title":"O pulsa Ctrl+Intro","users_placeholder":"Añadir usuario","title_placeholder":"En una frase breve, ¿de qué trata este tema?","edit_reason_placeholder":"¿Por que lo editas?","show_edit_reason":"(añadir motivo de edición)","reply_placeholder":"Escribe aquí. Puedes usar Markdown o BBCode para dar formato. Arrastra o pega una imagen aquí para subirla.","view_new_post":"Ver tu nuevo post.","saving":"Guardando...","saved":"¡Guardado!","saved_draft":"Tienes el borrador de un post sin terminar. Haz clic en esta barra para continuar editándolo.","uploading":"Subiendo...","show_preview":"mostrar vista previa \u0026raquo;","hide_preview":"\u0026laquo; ocultar vista previa","quote_post_title":"Citar todo el post","bold_title":"Negrita","bold_text":"Texto en negrita","italic_title":"Cursiva","italic_text":"Texto en cursiva","link_title":"Hipervínculo","link_description":"introduzca descripción de enlace aquí","link_dialog_title":"Insertar enlace","link_optional_text":"título opcional","quote_title":"Cita","quote_text":"Cita","code_title":"Código de muestra","code_text":"texto preformateado precedido por 4 espacios","upload_title":"Imagen","upload_description":"introduce una descripción de la imagen aquí","olist_title":"Lista numerada","ulist_title":"Lista con viñetas","list_item":"Lista de items","heading_title":"Encabezado","heading_text":"Encabezado","hr_title":"Linea Horizontal","undo_title":"Deshacer","redo_title":"Rehacer","help":"Ayuda de edición Markdown","toggler":"ocultar o mostrar el panel de edición","admin_options_title":"Opciones de moderación para este tema","auto_close_label":"Hora de auto-cierre:","auto_close_units":"(# de horas, una fecha, o marca de tiempo)","auto_close_examples":"Poner el tiempo exacto o el número de horas -24, 17:00, 2013-11-22 14:00","auto_close_error":"Por favor, ingrese un valor válido."},"notifications":{"title":"notificaciones por menciones a tu @nombre, respuestas a tus publicaciones y temas, mensajes privados, etc.","none":"No tienes notificaciones por el momento.","more":"ver notificaciones antiguas","total_flagged":"total de posts reportados","mentioned":"\u003ci title='mentioned' class='icon'\u003e@\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='quoted' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='edited' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='accepted your invitation' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e ha aceptado tu invitación\u003c/p\u003e","moved_post":"\u003ci title='moved post' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e movió {{description}}\u003c/p\u003e","linked":"\u003ci title='linked post' class='fa fa-arrow-left'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='badge granted' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eSe te ha concedido '{{description}}'\u003c/p\u003e"},"upload_selector":{"title":"Añadir imagen","title_with_attachments":"Añadir una imagen o archivo","from_my_computer":"Desde mi dispositivo","from_the_web":"Desde la Web","remote_tip":"introduce la dirección de una imagen de la siguiente forma: http://ejemplo.com/imagen.jpg","remote_tip_with_attachments":"introduce la dirección de una imagen o un archivo de la siguiente forma: http://ejemplo.com/achivo.ext (extensiones válidas: {{authorized_extensions}}).","local_tip":"clic para seleccionar una imagen desde tu dispositivo.","local_tip_with_attachments":"clic para seleccionar una imagen o un archivo desde tu dispositivo (extensiones válidas: {{authorized_extensions}})","hint":"(también puedes arrastrarlos al editor para subirlos)","hint_for_supported_browsers":"(también puedes arrastrar o pegar imágenes en el editor para subirlas)","uploading":"Subiendo imagen","image_link":"el link de tu imagen apuntará a"},"search":{"title":"buscar temas, posts, usuarios o categorías","no_results":"No se ha encontrado ningún resultado.","searching":"Buscando ...","context":{"user":"Buscar posts por @{{username}}","category":"Buscar la categoría \"{{category}}\"","topic":"Buscar este tema"}},"site_map":"ir a otra lista de temas o categoría","go_back":"volver","not_logged_in_user":"página con el resumen de actividad y preferencias","current_user":"ir a tu página de usuario","starred":{"title":"Favoritos","help":{"star":"añadir este tema a tu lista de favoritos","unstar":"quitar este tema de tu lista de favoritos"}},"topics":{"bulk":{"reset_read":"Restablecer leídos","delete":"Eliminar temas","dismiss_posts":"Ignorar publicaciones","dismiss_posts_tooltip":"Limpiar contadores de 'no leídos' en estos temas pero continuar mostrándolos en mi lista de 'no leídos' cuando se hacen nuevas publicaciones","dismiss_topics":"Descartar Temas","dismiss_topics_tooltip":"Dejar de mostrar estos temas en mi lista de 'no leídos' cuando se hacen nuevas publicaciones","dismiss_new":"Ignorar nuevos","toggle":"activar selección de temas en bloque","actions":"Acciones en bloque","change_category":"Cambiar categoria","close_topics":"Cerrar temas","notification_level":"Cambiar el nivel de notificación","selected":{"one":"Has seleccionado \u003cb\u003e1\u003c/b\u003e tema.","other":"Has seleccionado \u003cb\u003e{{count}}\u003c/b\u003e temas."}},"none":{"starred":"Todavía no has marcado ningún tema como favorito. Para marcar uno, haz clic o toca con el dedo la estrella que está junto al título del tema.","unread":"No existen temas que sigas y que ya no hayas leído.","new":"No tienes temas nuevos por leer.","read":"Todavía no has leído ningún tema.","posted":"Todavía no has publicado en ningún tema.","latest":"No hay temas recientes. Qué pena...","hot":"No hay temas calientes nuevos.","category":"No hay temas en la categoría {{category}}.","top":"No hay temas en el top más vistos.","educate":{"new":"\u003cp\u003ePor defecto, se consideran nuevos los temas creados en los últimos 2 días.\u003c/p\u003e\u003cp\u003ePuedes cambiar esto en tus \u003ca href=\"%{userPrefsUrl}\"\u003epreferencias\u003c/a\u003e.\u003c/p\u003e","unread":"\u003cp\u003ePor defecto, el indicador de temas no leídos aparecen únicamente para temas que has:\u003c/p\u003e\u003cul\u003e\u003cli\u003eCreado\u003c/li\u003e\u003cli\u003eComentado\u003c/li\u003e\u003cli\u003eLeído durante más de 4 minutos\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eO, si has elegido específicamente la opción de Seguir o Vigilar en el pie del tema.\u003c/p\u003e\u003cp\u003ePuedes cambiar esto en tus \u003ca href=\"%{userPrefsUrl}\"\u003epreferencias\u003c/a\u003e.\u003c/p\u003e"}},"bottom":{"latest":"No hay más temas recientes para leer.","hot":"No hay más temas calientes.","posted":"No hay más temas publicados para leer.","read":"No hay más temas leídos.","new":"No hay temas nuevos para leer.","unread":"No hay más temas que no hayas leídos.","starred":"No hay más temas favoritos para leer.","category":"No hay más temas en la categoría {{category}}.","top":"No hay más temas en el top más vistos."}},"topic":{"filter_to":"Mostart {{post_count}} posts por tema","create":"Crear tema","create_long":"Crear un nuevo tema","private_message":"Empezar una conversación privada","list":"Temas","new":"nuevo tema","unread":"No leídos","new_topics":{"one":"1 tema nuevo","other":"{{count}} temas nuevos"},"unread_topics":{"one":"1 tema sin leer","other":"{{count}} temas sin leer"},"title":"Tema","loading_more":"Cargando más temas...","loading":"Cargando tema...","invalid_access":{"title":"Este tema es privado","description":"Lo sentimos, ¡no tienes acceso a este tema!","login_required":"Tienes que iniciar sesión para poder ver este tema."},"server_error":{"title":"El tema falló al intentar ser cargado","description":"Lo sentimos, no pudimos cargar el tema, posiblemente debido a problemas de conexión. Por favor, inténtalo nuevamente. Si el problema persiste, por favor contacta con soporte."},"not_found":{"title":"tema no encontrado","description":"Lo sentimos, no pudimos encontrar ese tema. ¿Tal vez fue eliminado por un moderador?"},"total_unread_posts":{"one":"tienes 1 publicación sin leer en este tema","other":"tienes {{count}} publicaciones sin leer en este tema"},"unread_posts":{"one":"tienes 1 post antiguo sin leer en este tema","other":"tienes {{count}} posts antiguos sin leer en este tema"},"new_posts":{"one":"hay 1 nuevo post en este tema desde la última vez que lo leíste","other":"hay {{count}} posts nuevos en este tema desde la última vez que lo leíste"},"likes":{"one":"este tema le gusta a 1 persona","other":"este tema les gusta a {{count}} personas"},"back_to_list":"Volver a la lista de temas","options":"Opciones del tema","show_links":"mostrar enlaces dentro de este tema","toggle_information":"detalles del tema","read_more_in_category":"¿Quieres leer más? Consulta otros temas en {{catLink}} or {{latestLink}}.","read_more":"¿Quieres seguir leyendo? {{catLink}} or {{latestLink}}.","browse_all_categories":"Ver todas las categorías","view_latest_topics":"ver los temas recientes","suggest_create_topic":"¿Por qué no creas un tema?","jump_reply_up":"saltar a respuesta anterior","jump_reply_down":"saltar a ultima respuesta","deleted":"El tema ha sido borrado","auto_close_notice":"Este tema se cerrará automáticamente en %{timeLeft}.","auto_close_title":"Configuración de auto-cerrado","auto_close_save":"Guardar","auto_close_remove":"No auto-cerrar este tema","progress":{"title":"avances","go_top":"arriba","go_bottom":"abajo","go":"ir","jump_bottom_with_number":"saltar al post %{post_number}","total":"total","current":"post actual","position":"post %{current} de %{total}"},"notifications":{"reasons":{"3_6":"Recibirás notificaciones porque estás vigilando esta categoría.","3_5":"Recibirás notificaciones porque has empezado a vigilar este tema automáticamente.","3_2":"Recibirás notificaciones porque estás vigilando este tema.","3_1":"Recibirás notificaciones porque creaste este tema.","3":"Recibirás notificaciones porque estás vigilando este tema.","2_8":"Recibirás notificaciones porque estás siguiendo esta categoría.","2_4":"Recibirás notificaciones porque has posteado una respuesta en este tema.","2_2":"Recibirás notificaciones porque estás siguiendo este tema.","2":"Recibirás notificaciones porque tu \u003ca href=\"/users/{{username}}/preferences\"\u003ehas leido este tema\u003c/a\u003e.","1_2":"Serás notificado solo si alguien menciona tu @nombre o responde a tu post.","1":"Serás notificado solo si alguien menciona tu @nombre o responde a tu post.","0_7":"Estás ignorando todas las notificaciones en esta categoría.","0_2":"Estás ignorando todas las notificaciones en este tema.","0":"Estás ignorando todas las notificaciones en este tema."},"watching_pm":{"title":"Vigilar","description":"Se te notificará de todos los nuevos posts en este mensaje privado. Aparecerá también un contador de posts nuevos y posts no leídos en el listado de temas."},"watching":{"title":"Vigilar","description":"Se te notificará de cada nuevo post en este tema. Se añadirá también un contador de temas sin leer y nuevos posts en la lista de temas."},"tracking_pm":{"title":"Seguir","description":"Aparecerá un contador de posts no leídos y posts nuevos al lado del mensaje privado. Se te notificará solo si alguien menciona tu @usuario o responde a algundo de tus posts."},"tracking":{"title":"Seguir","description":"Se añadirá un contador de posts sin leer y posts nuevos en la lista de temas. Se te notificará solo si alguien menciona tu @nombre o te responde a un post."},"regular":{"title":"Normal","description":"Serás notificado solo si alguien menciona tu @nombre o responde a tus posts."},"regular_pm":{"title":"Normal","description":"Se te notificará solo si alguien menciona tu @nombre o responde a tus posts en el hilo de mensajes privados."},"muted_pm":{"title":"Silenciar","description":"No se te notificará sobre este mensaje privado."},"muted":{"title":"Silenciar","description":"no serás notificado de nada en este tema, y no aparecerá en tu pestaña de no leidos."}},"actions":{"recover":"Deshacer borrar tema","delete":"Eliminar tema","open":"Abrir tema","close":"Cerrar tema","auto_close":"Auto-cierre","make_banner":"Tema de encabezado. ","remove_banner":"Remover tema de encabezado. ","unpin":"Dejar de destacar","pin":"Destacar tema","pin_globally":"Destacar tema globalmente","unarchive":"Desarchivar tema","archive":"Archivar tema","invisible":"Hacer invisible","visible":"Hacer visible","reset_read":"Restablecer datos de lectura","multi_select":"Seleccionar posts para mover o eliminar"},"reply":{"title":"Responder","help":"comienza a escribir una respuesta a este tema"},"clear_pin":{"title":"Eliminar Destacado","help":"Elimina el estado 'Destacado' de este tema para que no aparezca más en lo más alto de tu lista de temas"},"share":{"title":"Compartir","help":"comparte un link a este tema"},"flag_topic":{"title":"Reportar","help":"reportar de forma privada para atención de los moderadores o enviar una notificación privada sobre él","success_message":"Has reportado este tema correctamente."},"inviting":"Invitando...","automatically_add_to_groups_optional":"Esta invitación incluye además acceso a estos grupos: (opcional, solo administradores)","automatically_add_to_groups_required":"Esta invitación incluye además acceso a estos grupos: (\u003cb\u003eRequerido\u003c/b\u003e, solo administradores)","invite_private":{"title":"Invitar por mensaje Privado","email_or_username":"Invitación por email o nombre de usuario","email_or_username_placeholder":"dirección de email o nombre de usuario","action":"Invitar","success":"Hemos invitado a ese usuario a participar en este mensaje privado.","error":"Lo sentimos hubo un error invitando a ese usuario.","group_name":"nombre del grupo"},"invite_reply":{"title":"Invitar","action":"Invitar por email","help":"enviar invitaciones a tus amigos para que puedan responder a este tema con un solo clic","to_topic":"Enviaremos un correo electrónico breve permitiendo a tu amigo unirse inmediatamente y publicar en este tema al hacer clic en un enlace, sin necesidad de iniciar de sesión.","to_forum":"Enviaremos un correo electrónico breve permitiendo a tu amigo unirse inmediatamente al hacer clic en un enlace, sin necesidad de iniciar sesión.","email_placeholder":"dirección de email","success":"Hemos enviado una invitación por email a \u003cb\u003e{{email}}\u003c/b\u003e. Te notificaremos cuando la invitación sea aceptada. Revisa la pestaña de invitaciones en tu página de perfil para llevar el seguimiento de tus invitaciones.","error":"Lo sentimos, no podemos invitar a esa persona. ¿Tal vez ya es un usuario?"},"login_reply":"Inicia sesión para responder","filters":{"n_posts":{"one":"1 post","other":"{{count}} posts"},"cancel":"Mostrar de nuevo todos los posts de este tema."},"split_topic":{"title":"Mover a un tema nuevo","action":"mover a un tema nuevo","topic_name":"Nombre del tema nuevo","error":"Hubo un error moviendo los posts al nuevo tema","instructions":{"one":"Estas a punto de crear un tema nuevo y rellenarlo con el post que has seleccionado.","other":"Estas a punto de crear un tema nuevo y rellenarlo con los \u003cb\u003e{{count}}\u003c/b\u003e posts que has seleccionado."}},"merge_topic":{"title":"Mover a un tema existente","action":"mover a un tema existente","error":"Hubo un error moviendo los posts a ese tema","instructions":{"one":"Por favor escoge el tema al que quieres mover ese post.","other":"Por favor escoge el tema al que quieres mover esos \u003cb\u003e{{count}}\u003c/b\u003e posts."}},"change_owner":{"title":"Cambiar dueño de los posts","action":"cambiar dueño","error":"Hubo un error cambiando la autoría de los posts.","label":"Nuevo dueño de los posts","placeholder":"nombre de usuario del nuevo dueño","instructions":{"one":"Por favor escoge el nuevo dueño del {{count}} post de \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Por favor escoge el nuevo dueño de los {{count}} posts de \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"Ten en cuenta que las notificaciones sobre este post no serán transferidas al nuevo usuario de forma retroactiva.\u003cbr\u003eAviso: actualmente, los datos que no dependen del post son transferidos al nuevo usuario. Usar con precaución."},"multi_select":{"select":"seleccionar","selected":"seleccionado ({{count}})","select_replies":"seleccionar más respuestas","delete":"eliminar seleccionado","cancel":"cancelar selección","select_all":"seleccionar todo","deselect_all":"deshacer selección","description":{"one":"Has seleccionado \u003cb\u003e1\u003c/b\u003e post.","other":"Has seleccionado \u003cb\u003e{{count}}\u003c/b\u003e posts."}}},"post":{"reply":"Respondiendo a {{link}} por {{replyAvatar}} {{username}}","reply_topic":"Responder a {{link}}","quote_reply":"citar","edit":"Edición {{link}} por {{replyAvatar}} {{username}}","edit_reason":"Motivo:","post_number":"post {{number}}","in_reply_to":"responder a","last_edited_on":"post editado por última ven en","reply_as_new_topic":"Responder como nuevo tema","continue_discussion":"Continuando la discusión desde {{postLink}}:","follow_quote":"ir al post citado","show_full":"Mostrar todo el post","show_hidden":"Ver el contenido oculto.","deleted_by_author":{"one":"(post retirado por el autor. Será borrado automáticamente en %{count} hora si no es reportado)","other":"(post retirado por el autor. Será borrado automáticamente en %{count} horas si no es reportado)"},"expand_collapse":"expandir/contraer","gap":{"one":"1 post oculto","other":"{{count}} posts ocultos"},"more_links":"{{count}} más...","unread":"Post sin leer","has_replies":{"one":"Respuesta","other":"Respuestas"},"errors":{"create":"Lo sentimos, hubo un error al crear tu post. Por favor, inténtalo de nuevo.","edit":"Lo sentimos, hubo un error al editar tu post. Por favor, inténtalo de nuevo.","upload":"Lo sentimos, hubo un error al subir el archivo. Por favor, inténtalo de nuevo.","attachment_too_large":"Lo siento, el archivo que estas intentando subir es demasiado grande (el tamaño máximo es {{max_size_kb}}kb).","image_too_large":"Lo sentimos, la imagen que está intentando cargar es demasiado grande (el tamaño máximo es de {{max_size_kb}}kb), por favor, cambie el tamaño e inténtelo de nuevo.","too_many_uploads":"Lo siento solo puedes subir un archivo cada vez.","upload_not_authorized":"Lo sentimos, el archivo que intenta cargar no está autorizado (authorized extension: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Lo siento, usuarios nuevos no pueden subir imágenes.","attachment_upload_not_allowed_for_new_user":"Lo siento, usuarios nuevos no pueden subir archivos adjuntos."},"abandon":{"confirm":"¿Estás seguro que deseas abandonar tu post?","no_value":"No, mantener","yes_value":"Sí, abandonar"},"wiki":{"about":"Este post es tipo wiki, cualquier usuario registrado puede editarlo"},"archetypes":{"save":"Guardar opciones"},"controls":{"reply":"componer una respuesta para este post","like":"me gusta este post","has_liked":"te gusta este post","undo_like":"deshacer Me gusta","edit":"edita este post","edit_anonymous":"Lo sentimos, necesitas iniciar sesión para editar este post.","flag":"reporta esta publicación de forma privada para atención de los moderadores o enviarles un notificación privada sobre el tema","delete":"elimina este post","undelete":"deshace la eliminación de este post","share":"comparte un enlace a este post","more":"Más","delete_replies":{"confirm":{"one":"¿Quieres eliminar también la respuesta directa a este post?","other":"¿Quieres eliminar también las {{count}} respuestas directas a este post?"},"yes_value":"Sí, borrar también las respuestas","no_value":"No, solo este post"},"admin":"acciones de administrador para el post","wiki":"Formato wiki","unwiki":"Deshacer formato wiki"},"actions":{"flag":"Reportar","defer_flags":{"one":"Aplazar reporte","other":"Aplazar reportes"},"it_too":{"off_topic":"Reportar de esto también","spam":"Reportar de esto también","inappropriate":"Reportar de esto también","custom_flag":"Reportar de esto también","bookmark":"Guardarlo también como favorito","like":"Dale también un Me gusta","vote":"Votar por esto también"},"undo":{"off_topic":"Deshacer reporte","spam":"Deshacer reporte","inappropriate":"Deshacer reporte","bookmark":"Deshacer marcador","like":"Deshacer Me gusta","vote":"Deshacer voto"},"people":{"off_topic":"{{icons}} reportó esto como off-topic","spam":"{{icons}} reportó esto como spam","inappropriate":"{{icons}} flagged reportó esto como inapropiado","notify_moderators":"{{icons}} ha notificado a los moderadores","notify_moderators_with_url":"{{icons}} \u003ca href='{{postUrl}}'\u003emoderadores notificados\u003c/a\u003e","notify_user":"{{icons}} ha enviado un mensaje privado","notify_user_with_url":"{{icons}} ha enviado un \u003ca href='{{postUrl}}'\u003emensaje privado\u003c/a\u003e","bookmark":"{{icons}} ha marcado esto","like":"{{icons}} les gusta esto","vote":"{{icons}} ha votado esto"},"by_you":{"off_topic":"Has reportado esto como off-topic","spam":"Has reportado esto como Spam","inappropriate":"Has reportado esto como inapropiado","notify_moderators":"Has reportado esto para que sea moderado","notify_user":"Has enviado un mensaje privado a este usuario","bookmark":"Has marcado este post","like":"Te ha gustado esto","vote":"Has votado este post"},"by_you_and_others":{"off_topic":{"one":"Tú y otro usuarios habéis reportado esto como off-topic","other":"Tú y otros {{count}} usuarios habéis reportado esto como off-topic"},"spam":{"one":"Tú y otro usuario habéis reportado esto como off-topic","other":"Tú y otros {{count}} usuarios habéis reportado esto como spam"},"inappropriate":{"one":"Tú y otro usuario habéis reportado esto como inapropiado","other":"Tú y otros {{count}} usuarios habéis reportado esto como inapropiado"},"notify_moderators":{"one":"Tú y otro usuario habéis reportado esto para moderar","other":"Tú y otros {{count}} usuarios habéis reportado esto para moderar"},"notify_user":{"one":"Tú y otro usuario habéis enviado un mensaje privado a este usuario","other":"Tú y otros {{count}} usuarios habéis enviado un mensaje privado a este usuario"},"bookmark":{"one":"Tú y otro usuario habéis marcado este post","other":"Tú y otros {{count}} usuarios habéis marcado este post"},"like":{"one":"A ti y a otro usuario os ha gustado esto","other":"A ti y a otros {{count}} usuarios os ha gustado esto"},"vote":{"one":"Tú y otro usuario habéis votado este post","other":"Tú y otros {{count}} habéis votado este post"}},"by_others":{"off_topic":{"one":"1 usuario ha reportado esto como off-topic","other":"{{count}} usuarios han reportado esto como off-topic"},"spam":{"one":"1 usuario ha reportado esto como spam","other":"{{count}} usuarios han reportado esto como spam"},"inappropriate":{"one":"1 usuario ha reportado esto como inapropiado","other":"{{count}} usuarios han reportado esto como inapropiado"},"notify_moderators":{"one":"1 usuario ha reportado esto para que sea moderado","other":"{{count}} usuarios han reportado esto para que sea moderado"},"notify_user":{"one":"1 persona envió un mensaje privado a este usuario","other":"{{count}} envíaron un mensaje privado a este usuario"},"bookmark":{"one":"Una persona ha marcado este post","other":"{{count}} han marcado este post"},"like":{"one":"A 1 persona le gusta esto","other":"A {{count}} personas les gusta esto"},"vote":{"one":"Una persona ha votado este post","other":"{{count}} personas votaron este post"}}},"edits":{"one":"1 edición","other":"{{count}} ediciones","zero":"sin ediciones"},"delete":{"confirm":{"one":"¿Seguro que quieres eliminar ese post?","other":"¿Seguro que quieres eliminar todos esos posts?"}},"revisions":{"controls":{"first":"Primera revisión","previous":"Revisión anterior","next":"Siguiente revisión","last":"Última revisión","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e vs. \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Muestra la producción asistida con adiciones y eleminaciones en línea","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Mostrar la producción asistida estas de lado a lado","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Mostrar la fuente de la rebaja de un lado a otro","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Markdown"}},"details":{"edited_by":"Editado por"}}},"category":{"can":"puede\u0026hellip; ","none":"(sin categoría)","choose":"Seleccionar una categoría\u0026hellip;","edit":"editar","edit_long":"Editar","view":"Ver temas en la categoría","general":"General","settings":"Ajustes","delete":"Eliminar categoría","create":"Crear categoría","save":"Guardar categoria","creation_error":"Se ha producido un error al crear la categoría.","save_error":"Ha ocurrido un error al guardar la categoría","name":"Nombre de la categoría","description":"Descripción","topic":"categoría","logo":"Imagen (logo) para la categoría","background_image":"Imagen de fondo para la categoría","badge_colors":"Colores de los distintivos","background_color":"Color de fondo","foreground_color":"Colores de primer plano","name_placeholder":"Debe ser corto y conciso.","color_placeholder":"Cualquier color web","delete_confirm":"¿Estás seguro de que quieres eliminar esta categoría?","delete_error":"Ha ocurrido un error al borrar la categoria","list":"Lista de categorías","no_description":"Por favor, añade una descripción para esta categoría.","change_in_category_topic":"Editar descripción","already_used":"Este color ha sido usado para otra categoría","security":"Seguridad","images":"Imágenes","auto_close_label":"Cerrar automaticamente los temas después de:","auto_close_units":"horas","email_in":"Dirección de correo electrónico personalizada para el correo entrante:","email_in_allow_strangers":"Aceptar emails de usuarios anónimos sin cuenta","email_in_disabled":"La posibilidad de publicar nuevos temas por email está deshabilitada en los ajustes del sitio. Para habilitar la publicación de nuevos temas por email,","email_in_disabled_click":"activa la opción \"email in\".","allow_badges_label":"Permitir conceder distintivos en esta categoria","edit_permissions":"Editar permisos","add_permission":"Añadir permisos","this_year":"este año","position":"posición","default_position":"Posición predeterminada","position_disabled":"Las Categorías se mostrarán por orden de actividad. Para controlar el orden en que aparecen en las listas,","position_disabled_click":"activa la opción \"fixed category positions\".","parent":"Categoría primaria","notifications":{"watching":{"title":"Vigilar","description":"Automáticamente vigilarás todos los temas en estas categorías. Se te notificará de todos los posts y temas, y además aparecerá un contador de posts nuevos y no leídos en la lista de temas."},"tracking":{"title":"Seguir","description":"Automáticamente seguirás todos los nuevos temas en estas categorías. Aparecerá un contador de posts no leídos y posts nuevos en la lista de temas."},"regular":{"title":"Normal","description":"Se te notificará solo si alguien te menciona con tu @usuario o se responde a alguno de tus posts."},"muted":{"title":"Silenciadas","description":"No se te notificará de nuevos temas en estas categorías y no aparecerán en la pestaña de no leídos."}}},"flagging":{"title":"¿Por qué estas reportando de forma privada este post?","action":"Reportar post","take_action":"Tomar medidas","notify_action":"Mensaje privado","delete_spammer":"Borrar spammer","delete_confirm":"Estás a punto de eliminar \u003cb\u003e%{posts}\u003c/b\u003e publicaciones y \u003cb\u003e%{topics}\u003c/b\u003e temas de este usuario, borrar su cuenta, bloquear sus inicios de sesión desde su dirección IP \u003cb\u003e%{ip_address}\u003c/b\u003e, y añadir su dirección de email \u003cb\u003e%{email}\u003c/b\u003e a una lista de bloqueo permanente. ¿Estás seguro de que este usuario es realmente un spammer?","yes_delete_spammer":"Sí, borrar spammer","submit_tooltip":"Enviar el reporte privado","take_action_tooltip":"Alcanzar el umbral de reportes inmediatamente, en vez de esperar a más reportes de la comunidad","cant":"Lo sentimos, no puedes reportar este post en este momento.","custom_placeholder_notify_user":"¿Por qué este post requiere hablarle a este usuario directamente y por privado? Sé específico, constructivo y siempre amable.","custom_placeholder_notify_moderators":"¿Por qué este post requiere la atención de un moderador? Haznos saber qué te preocupa específicamente y añade los enlaces relevantes dónde sea posible.","custom_message":{"at_least":"introduce al menos {{n}} caracteres","more":"{{n}} para ir...","left":"{{n}} restantes"}},"flagging_topic":{"title":"¿Por qué estás reportando en privado este tema?","action":"Reportar tema","notify_action":"Mensaje privado"},"topic_map":{"title":"Resumen de temas","links_shown":"mostrar los {{totalLinks}} enlaces...","clicks":{"one":"1 clic","other":"%{count} clics"}},"topic_statuses":{"locked":{"help":"este tema está cerrado; ya no aceptan nuevas respuestas"},"unpinned":{"title":"Deseleccionado como destacado","help":"Este tema ha sido deseleccionado como destacado; se mostrará en el orden por defecto "},"pinned_globally":{"title":"Destacado globalmente","help":"Este tema ha sido destacado globalmente, se mostrará en la parte superior de todas las listas"},"pinned":{"title":"Destacado","help":"este tema está destacado; se mostrará en la parte superior de su categoría"},"archived":{"help":"este tema está archivado; está congelado y no puede ser cambiado"},"invisible":{"help":"este tema es invisible; no se mostrará en la lista de temas, y sólo se puede acceder a través de un enlace directo"}},"posts":"Posts","posts_lowercase":"publicaciones","posts_long":"{{number}} posts en este tema","original_post":"Post Original","views":"Visitas","views_lowercase":"Vistas","replies":"Respuestas","views_long":"este tema ha sido visto {{number}} veces","activity":"Actividad","likes":"Likes","likes_lowercase":"Likes","likes_long":"este tema tiene {{number}} me gusta","users":"Participantes","users_lowercase":"Usuarios","category_title":"Categoría","history":"Historia","changed_by":"por {{author}}","categories_list":"Lista de categorías","filters":{"with_topics":"%{filter} temas","with_category":"Temas de %{filter} %{category}","latest":{"title":"Recientes","help":"temas con publicaciones más recientes"},"hot":{"title":"Popular","help":"una selección de los temas más populares"},"starred":{"title":"Favoritos","help":"temas que has marcado como favoritos"},"read":{"title":"Leídos","help":"temas que ya has leído"},"categories":{"title":"Categorías","title_in":"Categoría - {{categoryName}}","help":"todos los temas agrupados por categoría"},"unread":{"title":{"zero":"No leídos","one":"No leído (1)","other":"No leídos ({{count}})"},"help":"temas que estás vigilando o siguiendo actualmente con posts no leídos","lower_title_with_count":{"one":"1 no leído","other":"{{count}} sin leer"}},"new":{"lower_title_with_count":{"one":"1 nuevo","other":"{{count}} nuevos"},"lower_title":"nuevo","title":{"zero":"Nuevos","one":"Nuevo (1)","other":"Nuevos ({{count}})"},"help":"temas publicados en los últimos días"},"posted":{"title":"Mis posts","help":"temas que has publicado"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"temas recientes en la categoría {{categoryName}}"},"top":{"title":"Lo mejor","help":"los temas más con más actividad del último año, mes, semana, o día","yearly":{"title":"Lo mejor del año"},"monthly":{"title":"Lo mejor del mes"},"weekly":{"title":"Lo mejor de la semana"},"daily":{"title":"Lo mejor del día"},"this_year":"Este año","this_month":"Este mes","this_week":"Esta semana","today":"Hoy","other_periods":"ver más de los mejores temas"}},"permission_types":{"full":"Crear / Responder / Ver","create_post":"Responder / Ver","readonly":"Ver"},"poll":{"voteCount":{"one":"1 voto","other":"%{count} votos"},"results":{"show":"Mostrar resultados","hide":"Ocultar resultados"},"close_poll":"Cerrar encuesta","open_poll":"Abrir encuesta"},"type_to_filter":"filtrar opciones...","admin":{"title":"Administrador de Discourse","moderator":"Moderador","dashboard":{"title":"Panel","last_updated":"Panel actualizado el:","version":"Versión instalada","up_to_date":"Está ejecutando la última versión de Discourse.","critical_available":"Actualización crítica disponible.","updates_available":"Hay actualizaciones disponibles.","please_upgrade":"Por favor actualiza!","no_check_performed":"Una revisión de actualizaciones no ha sido realizada aún. Asegúrate de que sidekiq está funcionando.","stale_data":"Una revisión de actualizaciones no ha sido realizada recientemente. Asegúrate de que sidekiq está funcionando.","version_check_pending":"Parece que has actualizado recientemente. Fantástico!","installed_version":"Instalado","latest_version":"Última versión","problems_found":"Hemos encontrado algunos problemas con tu instalación de Discourse","last_checked":"Ultima comprobación","refresh_problems":"Refrescar","no_problems":"Ningun problema ha sido encontrado.","moderators":"Moderadores:","admins":"Administradores:","blocked":"Bloqueados:","suspended":"Suspendidos:","private_messages_short":"PMs","private_messages_title":"Mensajes Privados","reports":{"today":"Hoy","yesterday":"Ayer","last_7_days":"Últimos 7 días","last_30_days":"Últimos 30 días","all_time":"Todo el tiempo","7_days_ago":"Hace 7 días","30_days_ago":"Hace 30 días","all":"Todo","view_table":"Ver como tabla","view_chart":"Ver como gráfico de tablas"}},"commits":{"latest_changes":"Cambios recientes: ¡actualiza a menudo!","by":"por"},"flags":{"title":"Reportes","old":"Antiguo","active":"Activo","agree":"De acuerdo","agree_title":"Confirmar esta indicación como válido y correcto.","agree_flag_modal_title":"Estar de acuerdo y...","agree_flag_hide_post":"Coincido (ocultar post + enviar MP)","agree_flag_hide_post_title":"Ocultar este post y enviar automáticamente un mensaje privado al usuario para que edite su post de forma urgente.","agree_flag":"Estar de acuerdo con la indicación","agree_flag_title":"Estar de acuerdo con la indicación y mantener la publicación intacta","defer_flag":"Aplazar","defer_flag_title":"Eliminar este indicador; no es necesaria ninguna acción en este momento.","delete":"Eliminar","delete_title":"Eliminar el post referido por este indicador.","delete_post_defer_flag":"Eliminar post y aplazar reporte","delete_post_defer_flag_title":"Eliminar post; si era el primero de un tema, eliminar el tema","delete_post_agree_flag":"Eliminar post y estar de acuerdo con la indicación","delete_post_agree_flag_title":"Eliminar post; si era el primero de un tema, eliminar el tema","delete_flag_modal_title":"Borrar y...","delete_spammer":"Eliminar spammer","delete_spammer_title":"Eliminar usuario y todos los posts y temas de ese usuario.","disagree_flag_unhide_post":"No coincido (volver a mostrar post)","disagree_flag_unhide_post_title":"Quitar todos los reportes de este post y hacerlo visible de nuevo","disagree_flag":"No coincido","disagree_flag_title":"Denegar esta indicación como inválida o incorrecta","clear_topic_flags":"Hecho","clear_topic_flags_title":"Este tema ha sido investigado y los problemas han sido resueltos. Haz click en Hecho para eliminar los reportes.","more":"(más respuestas...)","dispositions":{"agreed":"coincidió","disagreed":"no coincidió","deferred":"aplazado"},"flagged_by":"Reportado por","resolved_by":"Resuelto por","took_action":"Tomó medidas","system":"Sistema","error":"Algo salió mal","reply_message":"Responder","no_results":"No hay reportes.","topic_flagged":"Este \u003cstrong\u003etema\u003c/strong\u003e ha sido reportado.","visit_topic":"Visita el tema para tomar medidas","was_edited":"El post fue editado después del primer reporte","summary":{"action_type_3":{"one":"fuera de tema","other":"fuera de tema x{{count}}"},"action_type_4":{"one":"inapropiado","other":"inapropiado x{{count}}"},"action_type_6":{"one":"personalizado","other":"personalizado x{{count}}"},"action_type_7":{"one":"personalizado","other":"personalizado x{{count}}"},"action_type_8":{"one":"spam","other":"spam x{{count}}"}}},"groups":{"primary":"Grupo principal","no_primary":"(ningún grupo principal)","title":"Grupos","edit":"Editar grupos","refresh":"Actualizar","new":"Nuevo","selector_placeholder":"añadir usuarios","name_placeholder":"Nombre del grupo, sin espacios, al igual que la regla del nombre usuario","about":"Edita aquí las membresias y grupos","group_members":"Miembros del grupo","delete":"Borrar","delete_confirm":"Borrar este grupo?","delete_failed":"No se pudo borrar el grupo. Si este es un grupo automático, no se puede destruir."},"api":{"generate_master":"Generar clave maestra de API","none":"No hay ninguna clave de API activa en este momento.","user":"Usuario","title":"API","key":"Clave de API","generate":"Generar clave de API","regenerate":"Regenerar clave de API","revoke":"Revocar","confirm_regen":"Estás seguro que quieres reemplazar esa Clave de API con una nueva?","confirm_revoke":"Estás seguro que quieres revocar esa clave?","info_html":"Tu clave de API te permitirá crear y actualizar temas usando llamadas a JSON.","all_users":"Todos los usuarios"},"backups":{"title":"Copia de seguridad","menu":{"backups":"Copia de seguridad","logs":"Logs"},"none":"Ninguna copia disponible.","read_only":{"enable":{"title":"Habilitar el modo de 'solo-lectura'","text":"Habilitar el modo de 'solo-lectura'","confirm":"¿Estás seguro que quieres habilitar el modo de \"solo lectura\"?"},"disable":{"title":"Deshabilitar el modo de \"solo lectura\"","text":"Deshabilitar el modo de \"solo lectura\""}},"logs":{"none":"No hay información de momento..."},"columns":{"filename":"Nombre del archivo","size":"Tamaño"},"upload":{"text":"Subir","uploading":"SUBIENDO","success":"El archivo '{{filename}}' se ha subido correctamente.","error":"Ha ocurrido un error al subir el archivo '{{filename}}': {{message}}"},"operations":{"is_running":"Actualmente una operación se está procesando...","failed":"La {{operation}} falló. Por favor revisa los logs","cancel":{"text":"Cancelar","title":"Cancelar la operación actual","confirm":"¿Estás seguro que quieres cancelar la operación actual?"},"backup":{"text":"Crear copia","title":"Crear una copia de seguridad","confirm":"¿Quieres iniciar una nueva copia de seguridad?","without_uploads":"Sí (sin archivos subidos)"},"download":{"text":"Descargar","title":"Descargar la copia de seguridad"},"destroy":{"text":"Borrar","title":"Borrar la copia de seguridad","confirm":"¿Estás seguro que quieres borrar esta copia?"},"restore":{"is_disabled":"Restaurar está deshabilitado en la configuración del sitio.","text":"Restaurar","title":"Restaurar la copia de seguridad","confirm":"¿Estás seguro que quieres restaurar esta copia de seguridad?"},"rollback":{"text":"Deshacer","title":"Regresar la base de datos al estado funcional anterior","confirm":"¿Estás seguro que quieres regresar la base de datos al estado funcional anterior?"}}},"export_csv":{"users":{"text":"Exportar los usuarios","title":"Exportar una lista de los usuarios en una archivo CSV."},"success":"La exportación ha sido iniciada. Serás notificado en breves con los avances.","failed":"Exportación fallida, revisa los logs."},"customize":{"title":"Personalizar","long_title":"Personalizaciones del sitio","header":"Encabezado","css":"Hoja de estilo","mobile_header":"Encabezado móvil","mobile_css":"Hoja de estilo móvil","override_default":"No incluir hoja de estilo estándar","enabled":"Activado?","preview":"vista previa","undo_preview":"eliminar vista previa","rescue_preview":"estilo por defecto","explain_preview":"Ver el sitio con esta hoja de estilo","explain_undo_preview":"Volver a la hoja de estilo personalizada activada actualmente","explain_rescue_preview":"Ver el sitio con la hoja de estilo por defecto","save":"Guardar","new":"Nuevo","new_style":"Nuevo Estilo","delete":"Eliminar","delete_confirm":"¿Eliminar esta personalización?","about":"Modifica hojas de estilo CSS y cabeceras HTML en el sitio. Añade una personalización para empezar.","color":"Color","opacity":"Opacidad","copy":"Copiar","css_html":{"title":"CSS/HTML","long_title":"Personalizaciones CSS y HTML"},"colors":{"title":"Colores","long_title":"Esquemas de color","about":"Modifica los colores utilizados en el sitio sin editar el CSS. Añade un esquema de color para empezar.","new_name":"Nuevo esquema de color","copy_name_prefix":"Copia de","delete_confirm":"¿Eliminar este esquema de color?","undo":"deshacer","undo_title":"Deshacer los cambios a este color hasta el último guardado.","revert":"rehacer","revert_title":"Restaurar este color al esquema de Discourse por defecto.","primary":{"name":"primario","description":"La mayoría del texto, iconos y bordes."},"secondary":{"name":"secundario","description":"El color de fondo principal y el color de texto de algunos botones."},"tertiary":{"name":"terciario","description":"Enlaces, algunos botones, notificaciones y color de énfasis."},"quaternary":{"name":"cuaternario","description":"Enlaces de navegación."},"header_background":{"name":"fondo del encabezado","description":"Color de fondo del encabezado del sitio."},"header_primary":{"name":"encabezado primario","description":"Texto e iconos en el encabezado del sitio."},"highlight":{"name":"resaltado","description":"El color de fondo de los elementos resaltados en la página, como temas o posts."},"danger":{"name":"peligro","description":"Color del resaltado para acciones como eliminar temas o posts."},"success":{"name":"éxito","description":"Para indicar que una acción se realizó correctamente."},"love":{"name":"me gusta","description":"El color del botón de \"me gusta\""}}},"email":{"title":"Email","settings":"Ajustes","all":"Todos","sending_test":"Enviando e-mail de prueba...","test_error":"Hubo un error al enviar el email de prueba. Por favor, revisa la configuración de correo, verifica que tu servicio de alojamiento no esté bloqueando los puertos de conexión de correo, y prueba de nuevo.","sent":"Enviado","skipped":"Omitidos","sent_at":"Enviado a","time":"Fecha","user":"Usuario","email_type":"Email","to_address":"A dirección","test_email_address":"dirección de email de prueba","send_test":"Enviar email de prueba","sent_test":"enviado!","delivery_method":"Método de entrega","preview_digest":"Vista previa de Resumen","preview_digest_desc":"Esta es una herramienta para previsualizar el contenido de los emails de resumen enviados desde tu foro.","refresh":"Actualizar","format":"Formato","html":"html","text":"texto","last_seen_user":"Último usuario visto:","reply_key":"Key de respuesta","skipped_reason":"Saltar motivo","logs":{"none":"No se han encontrado registros.","filters":{"title":"filtro","user_placeholder":"nombre de usuario","address_placeholder":"nombre@ejemplo.com","type_placeholder":"resumen, registro...","skipped_reason_placeholder":"motivo"}}},"logs":{"title":"Logs","action":"Acción","created_at":"Creado","last_match_at":"Última coincidencia","match_count":"Coincidencias","ip_address":"IP","delete":"Eliminar","edit":"Editar","save":"Guardar","screened_actions":{"block":"bloquear","do_nothing":"no hacer nada"},"staff_actions":{"title":"Acciones del staff","instructions":"Haz clic en nombres de usuario y acciones para filtrar la lista. Haz clic en los avatares para ir a las páginas de los usuarios.","clear_filters":"Mostrar todo","staff_user":"Usuario administrador","target_user":"Usuario enfocado","subject":"Sujeto","when":"Cuándo","context":"Contexto","details":"Detalles","previous_value":"Anterior","new_value":"Nuevo","diff":"Diff","show":"Mostrar","modal_title":"Detalles","no_previous":"No existe un valor anterior.","deleted":"No hay un valor nuevo. El registro ha sido borrado.","actions":{"delete_user":"Borrar usuario","change_trust_level":"cambiar nivel de confianza","change_site_setting":"cambiar configuración del sitio","change_site_customization":"cambiar customización del sitio","delete_site_customization":"borrar customización del sitio","suspend_user":"suspender usuario","unsuspend_user":"desbloquear usuario","grant_badge":"conceder distintivo","revoke_badge":"revocar distintivo"}},"screened_emails":{"title":"Correos bloqueados","description":"Cuando alguien trata de crear una cuenta nueva, los siguientes correos serán revisados y el registro será bloqueado, o alguna otra acción será realizada.","email":"Correo electrónico","actions":{"allow":"Permitir"}},"screened_urls":{"title":"URLs bloqueadas","description":"Las URLs listadas aquí fueron utilizadas en posts de usuarios identificados como spammers.","url":"URL","domain":"Dominio"},"screened_ips":{"title":"IPs bloqueadas","description":"Direcciones IP que están siendo vigiladas. Usa \"Permitir\" para añadir direcciones IP preaprobadas.","delete_confirm":"Estás seguro que quieres remover el bloqueo para %{ip_address}?","actions":{"block":"Bloquear","do_nothing":"Permitir"},"form":{"label":"Nueva:","ip_address":"Dirección IP","add":"Añadir"}},"logster":{"title":"Registros de errores"}},"users":{"title":"Usuarios","create":"Añadir Usuario Administrador","last_emailed":"Último email enviado","not_found":"Lo sentimos, ese usuario no existe.","active":"Activo","nav":{"new":"Nuevo","active":"Activo","pending":"Pendiente","admins":"Administradores","moderators":"Moderadores","suspended":"Suspendidos","blocked":"Bloqueados"},"approved":"Aprobado/s?","approved_selected":{"one":"aprobar usuario","other":"aprobar ({{count}}) usuarios"},"reject_selected":{"one":"rechazar usuario","other":"rechazar ({{count}}) usuarios"},"titles":{"active":"Usuarios activos","new":"Usuarios nuevos","pending":"Usuarios pendientes de revisión","newuser":"Usuarios con nivel de confianza 0 (Nuevo)","basic":"Usuarios con nivel de confianza 1 (Básico)","regular":"Usuarios con nivel de confianza 2 (Usuario Normal)","elder":"Usuarios con nivel de confianza 4 (Sabio)","admins":"Administradores","moderators":"Moderadores","blocked":"Usuarios bloqueados","suspended":"Usuarios suspendidos"},"reject_successful":{"one":"1 usuario rechazado con éxito.","other":"%{count} usuarios rechazados con éxito."},"reject_failures":{"one":"Error al rechazar 1 usuario.","other":"Error al rechazar %{count} usuarios."}},"user":{"suspend_failed":"Algo salió mal baneando este usuario {{error}}","unsuspend_failed":"Algo salió mal quitando ban a este usuario {{error}}","suspend_duration":"¿Cuánto tiempo le gustaría aplicar ban al usuario? (days)","suspend_duration_units":"(días)","suspend_reason_label":"¿Por qué lo pospones? Este texto \u003cb\u003eserá visible para todos\u003c/b\u003e en la página de perfil del usuario, y además será mostrado al usuario cuando trate de ingresar en el sitio web. Mantenlo simplificado.","suspend_reason":"Causa","suspended_by":"Suspendido por","delete_all_posts":"Eliminar todos los posts","delete_all_posts_confirm":"Estás a punto de borrar %{posts} posts y %{topics} temas. ¿Estás seguro?","suspend":"Suspender","unsuspend":"Quitar ban","suspended":"¿Baneado?","moderator":"¿Moderador?","admin":"¿Administrador?","blocked":"¿Bloqueado?","show_admin_profile":"Administrador","edit_title":"Editar título","save_title":"Guardar título","refresh_browsers":"Forzar recarga del navegador","refresh_browsers_message":"¡Mensaje enviado a todos los clientes!","show_public_profile":"Ver perfil público","impersonate":"Impersonar a","ip_lookup":"Búsqueda de IP","log_out":"Cerrar sesión","logged_out":"El usuario ha cerrado sesión desde todos los dispositivos","revoke_admin":"Revocar administrador","grant_admin":"Conceder administración","revoke_moderation":"Revocar moderación","grant_moderation":"Conceder moderación","unblock":"Desbloquear","block":"Bloquear","reputation":"Reputación","permissions":"Permisos","activity":"Actividad","like_count":"Likes Dados / Recibidos","last_100_days":"en los últimos 100 días","private_topics_count":"Temas privados","posts_read_count":"Posts leídos","post_count":"Posts publicados","topics_entered":"Temas ingresados","flags_given_count":"Reportes enviados","flags_received_count":"Reportes recibidos","flags_given_received_count":"Reportes Enviados / Recibidos","approve":"Aprobar","approved_by":"aprobado por","approve_success":"Usuario aprobado y email enviado con instrucciones para la activación.","approve_bulk_success":"Exito! Todos los usuarios seleccionados han sido aprobados y notificados.","time_read":"Tiempo de lectura","delete":"Borrar usuario","delete_forbidden_because_staff":"Administradores y moderadores no pueden ser eliminados","delete_forbidden":{"one":"Los usuarios no se pueden borrar si han sido registrados hace más de %{count} día, o si tienen publicaciones. Borra todas publicaciones antes de tratar de borrar un usuario.","other":"Los usuarios no se pueden borrar si han sido registrados hace más de %{count} días, o si tienen publicaciones. Borra todas publicaciones antes de tratar de borrar un usuario."},"cant_delete_all_posts":{"one":"No se pueden eliminar todos los posts. Algunos tienen más de %{count} día de antigüedad. (Ver la opción delete_user_max_post_age )","other":"No se pueden eliminar todos los posts. Algunos tienen más de %{count} días de antigüedad. (Ver la opción delete_user_max_post_age )"},"cant_delete_all_too_many_posts":{"one":"No se pueden eliminar todos los posts porque el usuario tiene más de 1 post. (Ver la opción delete_all_posts_max)","other":"No se pueden eliminar todos los posts porque el usuario tiene más de %{count} posts. (Ver la opción delete_all_posts_max)"},"delete_confirm":"Estás SEGURO que quieres borrar este usuario? Esta acción es permanente!","delete_and_block":"Eliminar y \u003cb\u003ebloquear\u003c/b\u003e este correo y esta dirección IP","delete_dont_block":"Eliminar solo.","deleted":"El usuario fue borrado.","delete_failed":"Ha habido un error al borrar ese usuario. Asegúrate que todos las publicaciones han sido borrados antes de tratando de borrar este usuario.","send_activation_email":"Enviar correo de activación","activation_email_sent":"Un correo de activación ha sido enviado.","send_activation_email_failed":"Ha habido un problema enviando otro correo de activación. %{error}","activate":"Activar Cuenta","activate_failed":"Ha habido un problem activando el usuario.","deactivate_account":"Desactivar cuenta","deactivate_failed":"Ha habido un problema desactivando el usuario.","unblock_failed":"Ha habido un problema desbloqueando el usuario.","block_failed":"Ha habido un problema bloqueando el usuario.","deactivate_explanation":"Un usuario desactivado debe rehabilitar su dirección de correo.","suspended_explanation":"Un usuario suspendido no puede ingresar al sitio.","block_explanation":"Un usuario bloqueado no puede publicar posts ni crear temas.","trust_level_change_failed":"Ha habido un problema cambiando el nivel de confianza del usuario.","suspend_modal_title":"Suspender Usuario","trust_level_2_users":"Usuarios del nivel de Confianza 2","trust_level_3_requirements":"Requerimientos para nivel de confianza 3","tl3_requirements":{"title":"Requerimientos para el nivel de confianza 3","table_title":"En los últimos 100 días:","value_heading":"Valor","requirement_heading":"Requerimiento","visits":"Visitas","days":"días","topics_replied_to":"Temas respondidos A","topics_viewed":"Temas vistos","topics_viewed_all_time":"Temas vistos (desde siempre)","posts_read":"Posts leídos","posts_read_all_time":"Posts leídos (desde siempre)","flagged_posts":"Posts reportados","flagged_by_users":"Usuarios que lo reportaron","likes_given":"Likes dados","likes_received":"Likes recibidos","qualifies":"Califica para el nivel de confianza 3.","will_be_promoted":"Será promocionado en 24 horas.","does_not_qualify":"No califica para el nivel de confianza 3."},"sso":{"title":"Single Sign On","external_id":"ID externa","external_username":"Nombre de usuario","external_name":"Nombre","external_email":"Email","external_avatar_url":"URL del avatar"}},"site_content":{"none":"Elige un tipo de contenido para empezar a editar.","title":"Contenido","edit":"Editar contenido del sitio"},"site_settings":{"show_overriden":"Sólo mostrar lo personalizado","title":"Ajustes del sitio","reset":"restablecer","none":"ninguno","no_results":"Ningun resultado encontrado","clear_filter":"Limpiar filtro","categories":{"all_results":"Todo","required":"Requerido","basic":"Ajustes básicos","users":"Usuarios","posting":"Publicar","email":"Email","files":"Archivos","trust":"Niveles de confianza","security":"Seguridad","onebox":"Onebox","seo":"SEO","spam":"Spam","rate_limits":"Límites de velocidad","developer":"Desarrollador","embedding":"Embebido","legal":"Legal","uncategorized":"Otros","backups":"Copias de seguridad","login":"Login"}},"badges":{"title":"Distintivos","new_badge":"Nuevo distintivo","new":"Nuevo","name":"Nombre","badge":"Distintivo","display_name":"Nombre a mostrar","description":"Descripción","badge_type":"Tipo de distintivo","badge_grouping":"Grupo","badge_groupings":{"modal_title":"Grupos de distintivos"},"granted_by":"Concedido por","granted_at":"Concedido en","save":"Guardar","delete":"Borrar","delete_confirm":"¿Estás seguro de que quieres eliminar este distintivo?","revoke":"Revocar","revoke_confirm":"¿Estás seguro de que quieres revocar este distintivo?","edit_badges":"Editar distintivos","grant_badge":"Condecer distintivo","granted_badges":"Distintivos concedidos","grant":"Conceder","no_user_badges":"%{name} no tiene ningún distintivo.","no_badges":"No hay distintivos para conceder.","allow_title":"Permitir usar distintivo como título","multiple_grant":"Puede ser concedido varias veces","listable":"Mostrar distintivo en la página pública de distintivos","enabled":"Activar distintivo","icon":"Icono","query":"Consulta (SQL) para otorgar el distintivo","target_posts":"La consulta tiene como objetivo posts","auto_revoke":"Ejecutar diariamente la consulta de revocación","show_posts":"Mostrar el post por el que se concedió el distintivo en la página de distintivos","trigger":"Activador","trigger_type":{"none":"Actualizar diariamente","post_action":"Cuando un usuario interactúa con un post","post_revision":"Cuando un usuario edita o crea un post","trust_level_change":"Cuando cambia el nivel de confianza de un usuario","user_change":"Cuando se edita o se crea un usuario"}}},"lightbox":{"download":"descargar"},"keyboard_shortcuts_help":{"title":"Atajos de teclado","jump_to":{"title":"Saltar a","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e Inicio (Recientes)","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e Recientes","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e Nuevos","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e No leídos","starred":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ef\u003c/b\u003e Favoritos","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Categorias"},"navigation":{"title":"Navegación","jump":"\u003cb\u003e#\u003c/b\u003e Ir al post número","back":"\u003cb\u003eu\u003c/b\u003e Atrás","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Mover la selección arriba/abajo","open":"\u003cb\u003eo\u003c/b\u003e or \u003cb\u003eEntrar\u003c/b\u003e Abrir tema seleccionado"},"application":{"title":"Aplicación","create":"\u003cb\u003ec\u003c/b\u003e Crear un tema nuevo","notifications":"\u003cb\u003en\u003c/b\u003e Abrir notificaciones","site_map_menu":"\u003cb\u003e=\u003c/b\u003e Abrir el menú del mapa del sitio","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e Abrir el menú de perfil de usuario","search":"\u003cb\u003e/\u003c/b\u003e Buscar","help":"\u003cb\u003e?\u003c/b\u003e Abrir el asistente de accesos directos del teclado"},"actions":{"title":"Acciones","star":"\u003cb\u003ef\u003c/b\u003e Añadir tema a favoritos","share_topic":"\u003cb\u003eshift s\u003c/b\u003e Compartir tema","share_post":"\u003cb\u003es\u003c/b\u003e Compartir post","reply_topic":"\u003cb\u003eshift r\u003c/b\u003e Responder al tema","reply_post":"\u003cb\u003er\u003c/b\u003e Responder al post","quote_post":"\u003cb\u003eq\u003c/b\u003e Citar post","like":"\u003cb\u003el\u003c/b\u003e Me gusta el post","flag":"\u003cb\u003e!\u003c/b\u003e Reportar post","bookmark":"\u003cb\u003eb\u003c/b\u003e Marcar post","edit":"\u003cb\u003ee\u003c/b\u003e Editar post","delete":"\u003cb\u003ed\u003c/b\u003e Borrar post","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e Silenciar tema","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e Marcar este tema como normal (por defecto)","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e Seguir tema","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e Vigilar Tema"}},"badges":{"title":"Distintivos","allow_title":"¿se permite usar el distintivo como título?","multiple_grant":"¿se concede múltiples veces?","badge_count":{"one":"1 distintivo","other":"%{count} distintivos"},"more_badges":{"one":"+1 más","other":"+%{count} Más"},"granted":{"one":"1 concedido","other":"%{count} concedido"},"select_badge_for_title":"Seleccionar un distintivo para utilizar como tu título","no_title":"\u003cno title\u003e","badge_grouping":{"getting_started":{"name":"Primeros pasos"},"community":{"name":"Comunidad"},"trust_level":{"name":"Nivel de confianza"},"other":{"name":"Miscelánea"},"posting":{"name":"Escritura"}},"badge":{"editor":{"name":"Editor","description":"Editó un post por primera vez"},"basic_user":{"name":"Básico","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/4\"\u003eDispone\u003c/a\u003e de todas las funciones esenciales de la comunidad"},"regular_user":{"name":"Normal","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/5\"\u003eDispone\u003c/a\u003e de invitaciones para el foro"},"leader":{"name":"Líder","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/6\"\u003eDispone\u003c/a\u003e de la posibilidad de recategorizar, renombrar, sus enlaces no llevan la etiqueta \"nofollow\" y puede entrar en la sala VIP."},"elder":{"name":"Sabio","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/7\"\u003eDispone\u003c/a\u003e de la posibilidad de editar, destacar, cerrar, archivar y combinar temas o posts globalmente"},"welcome":{"name":"¡Bienvenido/a!","description":"Recibió un \"me gusta\""},"autobiographer":{"name":"Autobiógrafo","description":"Detalló información en su \u003ca href=\"/my/preferences\"\u003eperfil\u003c/a\u003e de usuario"},"nice_post":{"name":"Buen post","description":"Recibió 10 \"me gusta\" en un post. Este distintivo puede ser concedido varias veces"},"good_post":{"name":"Muy buen post","description":"Recibió 25 \"me gusta\" en un post. Este distintivo puede ser concedido varias veces"},"great_post":{"name":"Excelente post","description":"Recibió 50 \"me gusta\" en un post. Este distintivo puede ser concedido varias veces"},"first_like":{"name":"Primer \"me gusta\"","description":"Le dio a \"me gusta\" a un post"},"first_flag":{"name":"Primer reporte","description":"Reportó un post"},"first_share":{"name":"Primer compartido","description":"Compartió un post"},"first_link":{"name":"Primer enlace","description":"Añadió un enlace interno a otro tema"},"first_quote":{"name":"Primera cita","description":"Citó a un usuario"},"read_guidelines":{"name":"Directrices leídas","description":"Leyó las \u003ca href=\"/guidelines\"\u003edirectrices de la comunidad\u003c/a\u003e"},"reader":{"name":"Lector","description":"Leyó todos los posts en un tema con más de 100"}}}}}};
I18n.locale = 'es';
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
// locale : spanish (es)
// author : Julio Napurí : https://github.com/julionc

(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define(['moment'], factory); // AMD
    } else if (typeof exports === 'object') {
        module.exports = factory(require('../moment')); // Node
    } else {
        factory(window.moment); // Browser global
    }
}(function (moment) {
    var monthsShortDot = "ene._feb._mar._abr._may._jun._jul._ago._sep._oct._nov._dic.".split("_"),
        monthsShort = "ene_feb_mar_abr_may_jun_jul_ago_sep_oct_nov_dic".split("_");

    return moment.defineLocale('es', {
        months : "enero_febrero_marzo_abril_mayo_junio_julio_agosto_septiembre_octubre_noviembre_diciembre".split("_"),
        monthsShort : function (m, format) {
            if (/-MMM-/.test(format)) {
                return monthsShort[m.month()];
            } else {
                return monthsShortDot[m.month()];
            }
        },
        weekdays : "domingo_lunes_martes_miércoles_jueves_viernes_sábado".split("_"),
        weekdaysShort : "dom._lun._mar._mié._jue._vie._sáb.".split("_"),
        weekdaysMin : "Do_Lu_Ma_Mi_Ju_Vi_Sá".split("_"),
        longDateFormat : {
            LT : "H:mm",
            L : "DD/MM/YYYY",
            LL : "D [de] MMMM [del] YYYY",
            LLL : "D [de] MMMM [del] YYYY LT",
            LLLL : "dddd, D [de] MMMM [del] YYYY LT"
        },
        calendar : {
            sameDay : function () {
                return '[hoy a la' + ((this.hours() !== 1) ? 's' : '') + '] LT';
            },
            nextDay : function () {
                return '[mañana a la' + ((this.hours() !== 1) ? 's' : '') + '] LT';
            },
            nextWeek : function () {
                return 'dddd [a la' + ((this.hours() !== 1) ? 's' : '') + '] LT';
            },
            lastDay : function () {
                return '[ayer a la' + ((this.hours() !== 1) ? 's' : '') + '] LT';
            },
            lastWeek : function () {
                return '[el] dddd [pasado a la' + ((this.hours() !== 1) ? 's' : '') + '] LT';
            },
            sameElse : 'L'
        },
        relativeTime : {
            future : "en %s",
            past : "hace %s",
            s : "unos segundos",
            m : "un minuto",
            mm : "%d minutos",
            h : "una hora",
            hh : "%d horas",
            d : "un día",
            dd : "%d días",
            M : "un mes",
            MM : "%d meses",
            y : "un año",
            yy : "%d años"
        },
        ordinal : '%dº',
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
