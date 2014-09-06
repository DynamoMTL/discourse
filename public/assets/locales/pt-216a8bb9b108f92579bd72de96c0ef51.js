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
MessageFormat.locale.pt = function ( n ) {
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
r += "is <a href='/unread'>1 unread</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "are <a href='/unread'>" + (function(){ var x = k_1 - off_0;
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
r += (pf_0[ MessageFormat.locale["pt"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += " <a href='/new'>1 new</a> topic";
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
})() + " new</a> topics";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["pt"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
} , "posts_likes_MF" : function(d){
var r = "";
r += "This topic has ";
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
r += (pf_0[ MessageFormat.locale["pt"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
}});I18n.translations = {"pt":{"js":{"number":{"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}}},"dates":{"time":"H:mm","long_no_year":"DD MMM H:mm","long_no_year_no_time":"D MMM","long_with_year":"DD MMM YYY H:mm","long_with_year_no_time":"DD MMM YYYY","long_date_with_year":"D MMM, 'YY LT","long_date_without_year":"D MMM, LT","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c 1s","other":"\u003c %{count}s"},"x_seconds":{"one":"1s","other":"%{count}s"},"less_than_x_minutes":{"one":"\u003c 1m","other":"\u003c %{count}m"},"x_minutes":{"one":"1m","other":"%{count}m"},"about_x_hours":{"one":"1h","other":"%{count}h"},"x_days":{"one":"1d","other":"%{count}d"},"about_x_years":{"one":"1a","other":"%{count}a"},"over_x_years":{"one":"\u003e 1a","other":"\u003e %{count}a"},"almost_x_years":{"one":"1a","other":"%{count}a"},"date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"1 minuto","other":"%{count} minutos"},"x_hours":{"one":"1 hora","other":"%{count} horas"},"x_days":{"one":"1 dia","other":"%{count} dias"}},"medium_with_ago":{"x_minutes":{"one":"1 minuto atrás","other":"%{count} minutos atrás"},"x_hours":{"one":"1 hora atrás","other":"%{count} horas atrás"},"x_days":{"one":"1 dia atrás","other":"%{count} dias atrás"}}},"share":{"topic":"partilhar um link para este tópico","post":"partilhar um link para o post #%{postNumber}","close":"fechar","twitter":"partilhar este link no Twitter","facebook":"partilhar este link no Facebook","google+":"partilhar este link no Google+","email":"enviar este link num email"},"edit":"editar o título ou a categoria deste tópico","not_implemented":"Essa característica ainda não foi implementada, desculpe!","no_value":"Não","yes_value":"Sim","generic_error":"Pedimos desculpa, ocorreu um erro.","generic_error_with_reason":"Ocorreu um erro: %{error}","sign_up":"Registar","log_in":"Entrar","age":"Idade","joined":"Juntou-se","admin_title":"Admin","flags_title":"Sinalizações","show_more":"mostrar mais","links":"Links","links_lowercase":"links","faq":"FAQ","guidelines":"Diretrizes","privacy_policy":"Política de Privacidade","privacy":"Privacidade","terms_of_service":"Termos de Serviço","mobile_view":"Visualização Mobile","desktop_view":"Visualização Desktop","you":"Você","or":"ou","now":"agora","read_more":"ler mais","more":"Mais","less":"Menos","never":"nunca","daily":"diário","weekly":"semanal","every_two_weeks":"a cada duas semanas","max":"máx","character_count":{"one":"{{count}} caracter","other":"{{count}} caracteres"},"in_n_seconds":{"one":"em 1 segundo","other":"em {{count}} segundos"},"in_n_minutes":{"one":"em 1 minuto","other":"em {{count}} minutos"},"in_n_hours":{"one":"em 1 hora","other":"em {{count}} horas"},"in_n_days":{"one":"em 1 dia","other":"em {{count}} dias"},"suggested_topics":{"title":"Tópicos Sugeridos"},"about":{"simple_title":"Acerca","title":"Acerca de %{title}","stats":"Estatísticas do site","our_admins":"Os nossos admins","our_moderators":"Os nossos moderadores","stat":{"all_time":"Sempre","last_7_days":"Últimos 7 Dias"},"like_count":"Contagem de Gostos","topic_count":"Contagem de Tópicos","post_count":"Contagem de Posts","user_count":"Contagem de Utilizadores"},"bookmarks":{"not_logged_in":"desculpe, necessita de ter a sessão iniciada para marcar posts","created":"adicionou este post aos marcadores","not_bookmarked":"leu este post; clique para o adicionar aos marcadores","last_read":"este é o último post que leu; clique para o adicionar aos marcadores","remove":"Remover Marcador"},"topic_count_latest":{"one":"{{count}} tópico novo ou actualizado.","other":"{{count}} tópicos novos ou actualizados."},"topic_count_unread":{"one":"{{count}} tópico não lido.","other":"{{count}} tópicos não lidos."},"topic_count_new":{"one":"{{count}} novo tópico.","other":"{{count}} novos tópicos."},"click_to_show":"Clique para mostrar.","preview":"prever","cancel":"cancelar","save":"Gravar alterações","saving":"A gravar...","saved":"Guardado!","upload":"Enviar","uploading":"A enviar...","uploaded":"Enviado!","enable":"Ativar ","disable":"Desativar","undo":"Desfazer","revert":"Reverter","banner":{"close":"Dispensar este banner."},"choose_topic":{"none_found":"Nenhum tópico encontrado.","title":{"search":"Procurar Tópico pelo nome, URL ou id:","placeholder":"digite o título do tópico aqui"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e inseriu \u003ca href='{{topicUrl}}'\u003eo tópico\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eVocê\u003c/a\u003e inseriu \u003ca href='{{topicUrl}}'\u003eo tópico\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e respondeu \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eVocê\u003c/a\u003e respondeu a \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e respondeu ao \u003ca href='{{topicUrl}}'\u003etópico\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eVocê\u003c/a\u003e respondeu ao \u003ca href='{{topicUrl}}'\u003etópico\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e mencionou \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e mencionou \u003ca href='{{user2Url}}'\u003evocê\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eVocê\u003c/a\u003e mencionou \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Inserido por \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Inserido por \u003ca href='{{userUrl}}'\u003evocê\u003c/a\u003e","sent_by_user":"Enviado por \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Enviado por \u003ca href='{{userUrl}}'\u003evocê\u003c/a\u003e"},"groups":{"visible":"Grupo é visível para todos os utilizadores","title":{"one":"grupo","other":"grupos"},"members":"Membros","posts":"Posts","alias_levels":{"title":"Quem pode usar este grupo como nome de utilizador?","nobody":"Ninguém","only_admins":"Apenas admins","mods_and_admins":"Apenas moderadores e admins","members_mods_and_admins":"Apenas membros do grupo, moderadores e admins","everyone":"Todos"}},"user_action_groups":{"1":"Gostos dados","2":"Gostos recebidos","3":"Marcadores","4":"Tópicos","5":"Mensagens","6":"Respostas","7":"Menções","9":"Citações","10":"Favoritos","11":"Edições","12":"Itens Enviados","13":"Caixa de Entrada"},"categories":{"all":"todas as categorias","all_subcategories":"todas","no_subcategory":"nenhuma","category":"Categoria","posts":"Posts","topics":"Tópicos","latest":"Mais recente","latest_by":"mais recente por","toggle_ordering":"alternar o controlo de ordenação","subcategories":"Subcategorias","topic_stats":"Número de tópicos novos.","topic_stat_sentence":{"one":"%{count} novo tópico no passado %{unit}.","other":"%{count} novos tópicos no passado %{unit}."},"post_stats":"Número de posts novos.","post_stat_sentence":{"one":"%{count} novo post no passado %{unit}.","other":"%{count} novos posts no passado %{unit}."}},"ip_lookup":{"title":"Pesquisa de Endereço IP","hostname":"Hostname","location":"Local","location_not_found":"(desconhecido)","organisation":"Organização","phone":"Telefóne","other_accounts":"Outras contas com este endereço IP","no_other_accounts":"(nenhum)"},"user":{"said":"{{username}} enviou:","profile":"Perfil","mute":"Silenciar","edit":"Editar Preferências","download_archive":"fazer o download do arquivo das minhas mensagens","private_message":"Mensagem Particular","private_messages":"Mensagens","activity_stream":"Atividade","preferences":"Preferências","bookmarks":"Marcadores","bio":"Sobre mim","invited_by":"Convidado Por","trust_level":"Nível de Confiança","notifications":"Notificações","disable_jump_reply":"Não vá para o seu novo post após ter respondido","dynamic_favicon":"Exibir notificações de novas mensagens no favicon (experimental)","edit_history_public":"Permitir que outros utilizadores vejam as minhas revisões de publicação","external_links_in_new_tab":"Abrir todos os links externos numa nova aba","enable_quoting":"Citar texto selecionado na resposta","change":"alterar","moderator":"{{user}} é um moderador","admin":"{{user}} é um administrador","moderator_tooltip":"Este utilizador é um moderador","admin_tooltip":"Este utilizador é um admin","suspended_notice":"Utilizador suspenso até {{date}}.","suspended_reason":"Razão: ","watched_categories":"Observado","watched_categories_instructions":"Observará automaticamente todos os novos tópicos nestas categorias. Será notificado de todos os novos posts e tópicos. Além disso, a contagem de posts novos e não lidos irá surgir ao lado da listagem do tópico. ","tracked_categories":"Seguido ","tracked_categories_instructions":"Seguirá automaticamente todos os tópicos neste categorias. Uma contagem de postos novos e não lidos irá surgir ao lado da listagem do tópico.","muted_categories":"Silenciado","muted_categories_instructions":"Não será notificado relativamente a novos tópicos nestas categorias, e não aparecerão na sua lista de não lidos.","delete_account":"Eliminar Conta","delete_account_confirm":"Tem a certeza que quer eliminar de forma permanente a sua conta? Esta acção é definitiva!","deleted_yourself":"A sua conta foi eliminada com sucesso.","delete_yourself_not_allowed":"Neste momento não pode eliminar a sua conta. Contacte um administrador para que este elimine a sua conta por sí.","unread_message_count":"Mensagens","staff_counters":{"flags_given":"denúncias úteis lançadas","flagged_posts":"posts sinalizados","deleted_posts":"posts eleminados","suspensions":"suspensões"},"messages":{"all":"Todas","mine":"Minha","unread":"Não lidas"},"change_password":{"success":"(email enviado)","in_progress":"(a enviar email)","error":"(erro)","action":"Enviar email para recuperar a palavra-chave","set_password":"Defenir Senha"},"change_about":{"title":"Modificar Sobre Mim"},"change_username":{"title":"Alterar Nome de Utilizador","confirm":"É possível haver consequências ao alterar o nome de utilizador. Tem a certeza?","taken":"Desculpe, esse nome de utilizador já está a ser utilizado.","error":"Houve um erro ao alterar o seu nome de utilizador.","invalid":"Esse nome de utilizador é inválido. Deve conter apenas números e letras."},"change_email":{"title":"Alterar Email","taken":"Desculpe, esse email não é válido.","error":"Houve um erro ao alterar o email. Talvez ele já esteja a ser utilizado neste fórum?","success":"Enviamos um email para esse endereço. Por favor siga as instruções de confirmação."},"change_avatar":{"title":"Alterar o seu avatar","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e, baseado em","refresh_gravatar_title":"Actualize o seu Gravatar","letter_based":"Avatar atribuído pelo sistema","uploaded_avatar":"Foto pessoal","uploaded_avatar_empty":"Adicionar foto pessoal","upload_title":"Enviar a sua foto","upload_picture":"Carregar Imagem","image_is_not_a_square":"Alerta: nós cortamos a sua imagem, pois ela não era rectangular."},"change_profile_background":{"title":"Fundo de Perfil"},"email":{"title":"Email","instructions":"Nunca estará visível publicamente.","ok":"Parece OK. Vamos enviar um email para confirmar.","invalid":"Por favor coloque um endereço de email válido.","authenticated":"O seu email foi autenticado por {{provider}}.","frequency":"Vamos enviar-lhe emails apenas quando não o virmos há algum tempo e não tiver visto as coisas que temos enviado."},"name":{"title":"Nome","instructions":"Versão longa do seu nome.","too_short":"O seu nome é muito curto.","ok":"O seu nome parece bom."},"username":{"title":"Nome de Utilizador","instructions":"Tem de ser único, sem espaços, curto.","short_instructions":"As pessoas podem mencioná-lo utilizando @{{username}}.","available":"O seu nome de utilizador está disponível.","global_match":"O email corresponde ao nome de utilizador registado.","global_mismatch":"Já está registado. Tente {{suggestion}}?","not_available":"Não está disponível. Tente {{suggestion}}?","too_short":"O seu nome de utilizador é muito curto.","too_long":"O seu nome de utilizador é muito comprido.","checking":"A verificar a disponibilidade do nome de utilizador...","enter_email":"Nome de utilizador encontrado. Coloque o email referente a ele.","prefilled":"O email corresponde ao nome de um utilizador registado."},"locale":{"title":"Idioma de Interface","default":"(predefindio)"},"password_confirmation":{"title":"Palavra-chave novamente"},"last_posted":"Última Entrada","last_emailed":"Último Email","last_seen":"Visto","created":"Juntou-se","log_out":"Terminar sessão","location":"Localização","website":"Site","email_settings":"Email","email_digests":{"title":"Quando não visitar o site, envie-me um email com um resumo das novidades:","daily":"diariamente","weekly":"semanalmente","bi_weekly":"de duas em duas semanas"},"email_direct":"Receber um email quando alguém o cita, responde às suas mensagens, ou menciona o seu @nome_de_utilizador","email_private_messages":"Recebe um email quando alguém lhe envia uma mensagem particular","other_settings":"Outros","categories_settings":"Categorias","new_topic_duration":{"label":"Considerar tópicos como novos quando","not_viewed":"ainda não as viu","last_here":"criadas desde a sua última sessão","after_n_days":{"one":"criadas no último dia","other":"criadas nos últimos {{count}} dias"},"after_n_weeks":{"one":"criada na última semana","other":"criadas nas últimas {{count}} semanas"}},"auto_track_topics":"Seguir automaticamente os tópicos onde entra","auto_track_options":{"never":"nunca","always":"sempre","after_n_seconds":{"one":"passado 1 segundo","other":"passado {{count}} segundos"},"after_n_minutes":{"one":"passado 1 minuto","other":"passado {{count}} minutos"}},"invited":{"search":"escreva para procurar convites...","title":"Convites","user":"Utilizadores convidados","none":"Ainda não convidou alguém para aqui.","truncated":"Mostra os primeiros {{count}} convites.","redeemed":"Convites usados","redeemed_at":"Compensado","pending":"Convites Pendentes","topics_entered":"Tópicos Visualizados","posts_read_count":"Entradas Vistas","expired":"Este convite expirou.","rescind":"Remover","rescinded":"Convite Removido","time_read":"Tempo de Leitura","days_visited":"Dias Visitados","account_age_days":"Idade da conta em dias","create":"Enviar um Convite","bulk_invite":{"none":"Ainda não convidou ninguém. Pode enviar convites individuais, ou convidar um grupo de pessoas \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003e enviando um ficheiro com convites em massa.","text":"Convite em massa a partir do ficheiro","uploading":"CARREGANDO","success":"Envio de ficheiro feito com sucesso, será notificado em breve do seu progresso.","error":"Erro de envio '{{filename}}': {{message}}"}},"password":{"title":"Palavra-chave","too_short":"A sua palavra-chave é muito curta.","common":"Essa senha é demasiada comum.","ok":"A sua palavra-chave parece estar OK.","instructions":"Tem de ter pelo menos %{count} caracteres."},"ip_address":{"title":"Último endereço IP"},"registration_ip_address":{"title":"Registo endreço IP"},"avatar":{"title":"Avatar"},"title":{"title":"Título"},"filters":{"all":"Todos"},"stream":{"posted_by":"Colocado por","sent_by":"Enviado por","private_message":"mensagem privada","the_topic":"o tópico"}},"loading":"A carregar...","errors":{"prev_page":"enquanto tenta carregar","reasons":{"network":"Erro de Rede","server":"Erro de Servidor","forbidden":"Acesso Negado","unknown":"Erro"},"desc":{"network":"Por favor verifique a sua ligação.","network_fixed":"Parece que está de volta.","server":"Código de Erro: {{status}}","unknown":"Algo correu mal."},"buttons":{"back":"Voltar Atrás","again":"Tentar Novamente","fixed":"Carregar Página"}},"close":"Fechar","assets_changed_confirm":"Este site foi actualizado. Recarregar agora para a versão mais recente?","read_only_mode":{"enabled":"Um administrador activou o modo só de leitura. Pode continuar a navegar no site mas as interacções poderão não funcionar. ","login_disabled":"A função de login está desactivada enquanto o site se encontrar no modo só de leitura."},"learn_more":"sabe mais...","year":"ano","year_desc":"tópicos criados nos últimos 365 dias","month":"mês","month_desc":"tópicos criados nos últimos 30 dias","week":"semana","week_desc":"tópicos criados nos últimos 7 dias","day":"dia","first_post":"Primeira mensagem","mute":"Silenciar","unmute":"Reativar","last_post":"Última mensagem","last_post_lowercase":"último post","summary":{"description":"Existem \u003cb\u003e{{count}}\u003c/b\u003e respostas.","description_time":"Existem \u003cb\u003e{{count}}\u003c/b\u003e respostas com um tempo de leitura estimado \u003cb\u003e{{readingTime}} minutos\u003c/b\u003e.","enable":"Sumarize este tópico","disable":"Mostrar todas as mensagens"},"deleted_filter":{"enabled_description":"Este tópico contém posts eliminados, os quais foram ocultados.","disabled_description":"Tópicos eliminados no tópico são apresentados.","enable":"Ocultar Posts Eliminados","disable":"Mostrar Posts Eliminados"},"private_message_info":{"title":"Conversas Privadas","invite":"Convidar Outros...","remove_allowed_user":"Quer mesmo remover {{name}} desta mensagem privada?"},"email":"Email","username":"Nome de utilizador","last_seen":"Visto","created":"Criado","created_lowercase":"criado","trust_level":"Nível de confiança","search_hint":"nome de utilizador ou e-mail","create_account":{"title":"Criar Conta Nova","failed":"Houve um erro, talvez este email já esteja registado, tente usar o link Esqueci-me da Palavra-chave."},"forgot_password":{"title":"Esqueci-me da Palavra-chave","action":"Esqueci-me da minha palavra-chave","invite":"Coloque seu nome de utilizador ou endereço de email, e enviar-lhe-emos um email para refazer a sua palavra-chave.","reset":"Recuperar Palavra-chave","complete_username":"Se uma conta corresponder ao nome de utilizador \u003cb\u003e%{username}\u003c/b\u003e, receberá um email com instruções sobre como redefinir rapidamente a sua senha.","complete_email":"Se uma conta corresponder \u003cb\u003e%{email}\u003c/b\u003e, receberá um email com instruções sobre como redefinir rapidamente a sua senha."},"login":{"title":"Entrar","username":"Utilizador","password":"Palavra-chave","email_placeholder":"email ou nome de utilizador","caps_lock_warning":"Caps Lock ligado","error":"Erro desconhecido","blank_username_or_password":"Por favor insira o seu e-mail ou nome de utilizador, e senha.","reset_password":"Recuperar palavra-chave","logging_in":"A iniciar sessão...","or":"Ou","authenticating":"A autenticar...","awaiting_confirmation":"A sua conta está a aguardar ativação. Utilize o link 'Esqueci a Palavra-chave' para pedir um novo link para ativar o email","awaiting_approval":"A sua conta ainda não foi aprovada por um membro do staff. Receberá um email quando a sua conta for aprovada.","requires_invite":"Desculpe, o acesso a este fórum é permitido somente por convite de outro membro.","not_activated":"Não pode entrar ainda. Enviámos anteriormente um email de ativação para o endereço \u003cb\u003e{{sentTo}}\u003c/b\u003e. Por favor siga as instruções contidas neste email para ativar a sua conta.","resend_activation_email":"Carregue aqui para enviar o email de ativação novamente.","sent_activation_email_again":"Enviámos mais um email de ativação para o endereço \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Pode ser que demore alguns minutos; verifique sempre a sua pasta de spam ou lixo.","google":{"title":"Entrar com Google","message":"A autenticar com Google (certifique-se de que os bloqueadores de popup estão desativados)"},"google_oauth2":{"title":"Entrar com Google","message":"Autenticando com Google (certifique-se de que os bloqueadores de popup estão desactivados)"},"twitter":{"title":"Entrar com Twitter","message":"A autenticar com Twitter (certifique-se de que os bloqueadores de popup estão desativados)"},"facebook":{"title":"Entrar com Facebook","message":"A autenticar com o Facebook (certifique-se de que os bloqueadores de popup estão desativados)"},"yahoo":{"title":"Entrar com Yahoo","message":"A autenticar com Yahoo (certifique-se de que os bloqueadores de popup estão desativados)"},"github":{"title":"com GitHub","message":"A autenticar com GitHub (certifique-se de que os bloqueadores de popup estão desativados)"}},"composer":{"posting_not_on_topic":"A que tópico gostaria de responder?","saving_draft_tip":"a guardar","saved_draft_tip":"guardado","saved_local_draft_tip":"guardado localmente","similar_topics":"O seu tópico é similar a...","drafts_offline":"rascunhos offline","min_length":{"need_more_for_title":"{{n}} no título","need_more_for_reply":"{{n}} para chegar à mensagem"},"error":{"title_missing":"O Título é obrigatório","title_too_short":"Título tem que ter no mínimo {{min}} caracteres.","title_too_long":"Título não pode conter mais que {{max}} caracteres.","post_missing":"O post não pode estar vazio","post_length":"Post tem que ter no mínimo {{min}} caracteres.","category_missing":"Tem de escolher uma categoria"},"save_edit":"Guardar alterações","reply_original":"Responder no Tópico original","reply_here":"Responda Aqui","reply":"Responder","cancel":"Cancelar","create_topic":"Criar um Tópico","create_pm":"Criar uma Mensagem Particular","title":"Ou prima Ctrl+Enter","users_placeholder":"Adicionar um utilizador","title_placeholder":"Numa breve frase, de que se trata esta discussão?","edit_reason_placeholder":"Porque está a editar?","show_edit_reason":"(adicione a razão para a edição)","reply_placeholder":"Escreva a sua resposta aqui. Utilize Markdown ou BBCode para formatar. Arraste ou cole aqui uma imagem para enviar.","view_new_post":"Ver as suas novas mensagens.","saving":"A Gravar...","saved":"Gravado!","saved_draft":"Tem um rascunho de um post em progresso. Seleccione esta barra para retomar a edição.","uploading":"A enviar...","show_preview":"mostrar pré-visualização \u0026raquo;","hide_preview":"\u0026laquo; esconder pré-visualização","quote_post_title":"Citar mensagem inteira","bold_title":"Negrito","bold_text":"texto em negrito","italic_title":"Itálico","italic_text":"texto em itálico","link_title":"Link","link_description":"digite a descrição do link aqui","link_dialog_title":"Inserir Link","link_optional_text":"título opcional","quote_title":"Bloco de Citação","quote_text":"Bloco de Citação","code_title":"Texto pré-formatado","code_text":"encaixar texto pré-formatado até 4 espaços","upload_title":"Enviar","upload_description":"digite aqui a descrição do ficheiro enviado","olist_title":"Lista numerada","ulist_title":"Lista de items","list_item":"Item da Lista","heading_title":"Título","heading_text":"Título","hr_title":"Barra horizontal","undo_title":"Desfazer","redo_title":"Refazer","help":"Ajuda da edição Markdown","toggler":"esconder ou exibir o painel de composição","admin_options_title":"Configurações opcionais de staff para este tópico","auto_close_label":"Tempo de fecho automático do tópico:","auto_close_units":"(# de horas, de tempo, ou timestamp)","auto_close_examples":"insira tempo absoluto ou número de horas — 24, 17:00, 2013-11-22 14:00","auto_close_error":"Por favor insira um valor válido."},"notifications":{"title":"notificações de menção de @nome, respostas às suas mensagens e tópicos, mensagens privadas, etc","none":"Não há notifcações neste momento.","more":"ver notificações antigas","total_flagged":"mensagens sinalizadas totais","mentioned":"\u003ci title='mentioned' class='icon'\u003e@\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='quoted' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='edited' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='accepted your invitation' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e accepted your invitation\u003c/p\u003e","moved_post":"\u003ci title='moved post' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e moved {{description}}\u003c/p\u003e","linked":"\u003ci title='linked post' class='fa fa-arrow-left'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e"},"upload_selector":{"title":"Adicionar uma imagem","title_with_attachments":"Adicionar uma imagem ou um ficheiro","from_my_computer":"Do meu dispositivo ","from_the_web":"Da internet","remote_tip":"ligação para a imagem http://example.com/image.jpg","remote_tip_with_attachments":"link para a imagem ou ficheiro  http://example.com/file.ext (extensões permitidas: {{authorized_extensions}}).","local_tip":"Carregue para selecionar um ficheiro do seu dispositivo","local_tip_with_attachments":"carregue para selecionar uma imagem ou ficheiro do seu dispositivo (extensões permitidas: {{authorized_extensions}})","hint":"(poderá também arrastar o ficheiro para o editor para fazer o upload)","hint_for_supported_browsers":"(também pode arrastar ou colar imagens no editor de forma a carregá-las)","uploading":"A enviar","image_link":"link para a imagem aponta para"},"search":{"title":"pesquisar tópicos, posts, utilizadores, ou categorias","no_results":"Não foi encontrado nenhum resultado.","searching":"A procurar...","context":{"user":"Procurar posts por @{{username}}","category":"Procurar na categoria \"{{category}}\"","topic":"Pesquisar este tópico"}},"site_map":"ir para outra lista de tópicos ou categorias","go_back":"voltar atrás","not_logged_in_user":"página de utilizador com resumo da actividade actual e preferências  ","current_user":"ir para a sua página de utilizador","topics":{"bulk":{"reset_read":"Repor Leitura","delete":"Apagar Tópicos","dismiss_posts":"Dispensar Posts","dismiss_posts_tooltip":"Remover contagem de não lidos nestes tópicos, mas manter a apresentação dos mesmos no meu separador de não lidos quando são feitos novos posts","dismiss_topics":"Dispensar Tópicos","dismiss_topics_tooltip":"Parar a apresentação destes tópicos no meu separador de não lidos quando são feitos novos posts","dismiss_new":"Dispensar Novo","toggle":"activar selecção em massa de tópicos","actions":"Acções de Selecção","change_category":"Mudar Categoria","close_topics":"Fechar Tópicos","notification_level":"Mudar Nível de Notificação","selected":{"one":"Seleccionou  \u003cb\u003e1\u003c/b\u003e tópico.","other":"Seleccionou \u003cb\u003e{{count}}\u003c/b\u003e tópicos."}},"none":{"unread":"Há tópicos não lidos.","new":"Não há novos tópicos.","read":"Ainda não leu nenhum tópico.","posted":"Ainda não escreveu nenhum tópico.","latest":"Não há tópicos populares. Isso é triste.","hot":"Não há tópicos quentes.","category":"Não há tópicos na categoria {{category}}.","top":"Não existem tópicos.","educate":{"new":"\u003cp\u003ePor defeito, os tópicos são considerados novos quando criados nos últimos 2 dias.\u003c/p\u003e\u003cp\u003ePode alterar isto nas suas \u003ca href=\"%{userPrefsUrl}\"\u003epreferências\u003c/a\u003e.\u003c/p\u003e","unread":"\u003cp\u003ePor defeito, indicadores de não lidos surgirão apenas para tópicos que:\u003c/p\u003e\u003cul\u003e\u003cli\u003eCriou\u003c/li\u003e\u003cli\u003eRespondeu\u003c/li\u003e\u003cli\u003eLeu durante mais do que 4 minutos\u003c/li\u003e\u003cli\u003eOu, se definiu explicitamente o tópico para Acompanhar ou Vigiar no controlo de notificações que se encontra na parte inferior de cada tópico. Pode alterar isto nas suas \u003ca href=\"%{userPrefsUrl}\"\u003epreferências"}},"bottom":{"latest":"Não há mais tópicos recentes.","hot":"Não mais tópicos quentes.","posted":"Não há mais tópicos inseridos.","read":"Não há mais tópicos lidos.","new":"Não há mais tópicos novos.","unread":"Não há mais tópicos não lidos.","category":"Não há mais tópicos na categoria {{category}}.","top":"Não existem mais tópicos populares."}},"topic":{"filter_to":"{{post_count}} posts no tópico","create":"Criar Tópico","create_long":"Criar um novo Tópico","private_message":"Começar uma nova conversa privada","list":"Tópicos","new":"novo tópico","unread":"não lido","new_topics":{"one":"1 novo tópico","other":"{{count}} novos tópicos."},"unread_topics":{"one":"1 tópico não lido","other":"{{count}} tópicos não lidos"},"title":"Tópico","loading_more":"Carregando mais tópicos...","loading":"A Carregar tópico...","invalid_access":{"title":"Tópico é particular","description":"Desculpe, mas não tem acesso àquele tópico!","login_required":"Necessita de ter sessão iniciada para ver este tópico."},"server_error":{"title":"Falha ao carregar tópico","description":"Desculpe, não conseguimos carregar este tópico, possivelmente devido a um problema na conexão. Por favor teste novamente. Se o problema persistir, diga-nos."},"not_found":{"title":"Tópico não encontrado","description":"Desculpe, não foi possível encontrar esse tópico. Pode ser que ele tenha sido apagado?"},"total_unread_posts":{"one":"tem 1 post não lido neste tópico","other":"tem {{count}} posts não lidos neste tópico"},"unread_posts":{"one":"você possui 1 posts antigo que não foi lido neste tópico","other":"possui {{count}} mensagens antigas que não foram lidas neste tópico"},"new_posts":{"one":"há 1 nova postagem neste tópico desde a sua última leitura","other":"há {{count}} novas mensagens neste tópico desde a sua última leitura"},"likes":{"one":"há 1 curtida neste tópico","other":"há {{count}} gostos neste tópico"},"back_to_list":"Voltar à lista dos Tópicos","options":"Opções do Tópico","show_links":"mostrar links dentro desta mensagem","toggle_information":"alternar detalhes do tópico","read_more_in_category":"Pretende ler mais? Procurw outros tópicos em {{catLink}} ou {{latestLink}}.","read_more":"Pretende ler mais? {{catLink}} ou {{latestLink}}.","browse_all_categories":"Procurar todas as categorias","view_latest_topics":"ver tópicos mais recentes","suggest_create_topic":"Que tal começar um assunto?","jump_reply_up":"avançar para resposta mais recente","jump_reply_down":"avançar para resposta mais antiga","deleted":"Este tópico foi apagado","auto_close_notice":"Este tópico vai ser automaticamente fechado em %{timeLeft}.","auto_close_title":"Configurações para Fechar Automaticamente","auto_close_save":"Guardar","auto_close_remove":"Não Fechar Automaticamente Este Tópico","progress":{"title":"progresso do tópico","go_top":"top","go_bottom":"fim","go":"ir","jump_bottom_with_number":"ir para o post %{post_number}","total":"total de mensagens","current":"mensagem atual","position":"post %{current} de %{total}"},"notifications":{"reasons":{"3_6":"Receberá notificações porque está a acompanhar este tópico.","3_5":"Receberá notificações por começou a acompanhar automaticamente este tópico.","3_2":"Receberá notificações porque está a observar este tópico.","3_1":"Receberá notificações porque criou este tópico.","3":"Receberá notificações porque você está a acompanhar este tópico.","2_8":"Receberá notificações porque está a monitorizar esta categoria.","2_4":"Receberá notificações porque inseriu uma resposta neste tópico.","2_2":"Receberá notificações porque está a monitorizar este tópico.","2":"Receberá notificações porque \u003ca href=\"/users/{{username}}/preferences\"\u003eleu este tópico\u003c/a\u003e.","1_2":"Receberá notificações apenas se alguém mencionar o seu @nome ou responder à sua mensagem.","1":"Receberá notificações apenas se alguém mencionar o seu @nome ou responder à sua mensagem.","0_7":"Está a ignorar todas as notificações nesta categoria.","0_2":"Está a ignorar todas as notificações para este tópico.","0":"Está a ignorar todas as notificações para este tópico."},"watching_pm":{"title":"Observar","description":"Será notificado de todos os novos posts desta mensagem privada. Um contagem de posts novos e não lidos irá aparecer junto da listagem do tópico."},"watching":{"title":"Observar","description":"Será notificado sobre todos os novos posts neste tópico. Será também apresentada uma contagem de posts novos e não lidos ao lado da listagem de tópicos."},"tracking_pm":{"title":"Seguir","description":"Será apresentada uma contagem de posts novos e não lidos junto da mensagem privada. Será apenas notificado se alguém mencionar o seu @nome ou responder ao seu post."},"tracking":{"title":"Monitorar","description":"Será apresentada uma contagem de posts novos e não lidos ao lado da listagem de tópicos. Será apenas notificado quando alguém mencionar o seu @nome ou responder ao seu post."},"regular":{"title":"Regular","description":"Será apenas notificado quando alguém mencionar o seu @nome ou responder ao sei post."},"regular_pm":{"title":"Regular","description":"Receberá notificações apenas se alguém mencionar o seu @nome ou responder ao seu post na mensagem privada."},"muted_pm":{"title":"Silenciar","description":"Não será notificado relativamente a nada sobre esta mensagem privada."},"muted":{"title":"Silenciar","description":"Nunca será notificado relativamente ao quer que seja deste tópico, e não será apresentado no seu separador de 'não lido'."}},"actions":{"recover":"Recuperar Tópico","delete":"Apagar Tópico","open":"Abrir Tópico","close":"Fechar Tópico","auto_close":"Fechar Automaticamente","make_banner":"Apresentar tópico como Banner","remove_banner":"Remover apresentação do tópico como banner","unpin":"Remover Destaque do Tópico","pin":"Destacar Tópico","pin_globally":"Destacar Tópico Globalmente","unarchive":"Desarquivar Tópico","archive":"Arquivar Tópico","invisible":"Tornar Invisível","visible":"Tornar Visível","reset_read":"Repor Data de Leitura","multi_select":"Seleccionar Posts"},"reply":{"title":"Responder","help":"começa a compor uma resposta a este tópico"},"clear_pin":{"title":"Remover destaque","help":"Retirar destaque deste tópico para que ele não apareça mais no topo da sua lista de tópicos"},"share":{"title":"Partilhar","help":"Partilhar um link para este tópico"},"flag_topic":{"title":"Denunciar","help":"denunciar privadamente este tópico para consideração ou enviar uma notificação privada sobre este","success_message":"Denúncia do tópico realizada com sucesso."},"inviting":"A Convidar...","automatically_add_to_groups_optional":"Este convite também inclui acesso a estes grupo: (opcional, apenas Admin)","automatically_add_to_groups_required":"Esse convite também inclui acesso a estes grupos: (\u003cb\u003eObrigatório\u003cb\u003e, apenas Admin)","invite_private":{"title":"Convidar para Conversa Privada","email_or_username":"Email ou Nome de Utilizador do Convidado","email_or_username_placeholder":"endereço de email ou username","action":"Convite","success":"Convidamos esse utilizador para participar nesta conversa privada.","error":"Desculpe, houve um erro ao convidar esse utilizador.","group_name":"nome do grupo"},"invite_reply":{"title":"Convidar","action":"Email de Convite","help":"envie convites aos seus amigos para que eles possam responder a este tópico com um simples toque do rato.","to_topic":"Enviaremos um breve email que permitirá ao seu amigo juntar-se imediatamente e responder a este tópico clicando num link, não sendo necessário ter sessão iniciada. ","to_forum":"Enviaremos um breve email que permitirá ao seu amigo juntar-se imediatamente clicando num link, não sendo necessário ter sessão iniciada.","email_placeholder":"name@example.com","success":"Enviamos um convite para \u003cb\u003e{{email}}\u003c/b\u003e. Será notificado quando o convite for resgatado. Verifique o separador de convites na sua página de utilizador para poder acompanhar os seus convites.","error":"Desculpe, não podíamos convidar essa pessoa. Talvez já seja um utilizador?"},"login_reply":"Iniciar sessão para responder","filters":{"n_posts":{"one":"1 postagem","other":"{{count}} mensagens"},"cancel":"Mostrar novamente todas as mensagens deste tópico."},"split_topic":{"title":"Mover para um novo Tópico","action":"mover para novo tópico","topic_name":"Nome do Novo Tópico","error":"Houve um erro ao mover as mensagens para um novo tópico.","instructions":{"one":"Você está prestes a criar um novo tópico e populá-lo com a postagem que você selecionou.","other":"Está prestes a criar um novo tópico e populá-lo com as \u003cb\u003e{{count}}\u003c/b\u003e mensagens que selecionou."}},"merge_topic":{"title":"Mover para Tópico Existente","action":"mover para tópico existente","error":"Houve um erro ao mover as mensagens para aquele tópico.","instructions":{"one":"Por favor selecione o tópico para o qual você gostaria de mover esta postagem.","other":"Por favor selecione o tópico para o qual gostaria de mover estas \u003cb\u003e{{count}}\u003c/b\u003e mensagens."}},"change_owner":{"title":"Mudar proprietário dos posts","action":"mudar titularidade","error":"Verificou-se um erro na mudança de titularidade dos posts.","label":"Novo proprietário dos Posts","placeholder":"nome de utilizador do novo proprietário","instructions":{"one":"Por favor seleccione o novo titular do post por \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Por favor seleccione o novo titular dos {{count}} posts por \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"Atenção que nenhumas notificações relacionadas com este post serão transferidas retroactivamente para o novo utilizador. \u003cbr\u003eAviso: Actualmente nenhum dado dependente do post é transferido para o novo utilizador. Usar com cautela."},"multi_select":{"select":"selecionar","selected":"({{count}}) selecionados","select_replies":"selecione +respostas","delete":"apagar selecionados","cancel":"cancelar seleção","select_all":"seleccionar tudo ","deselect_all":"desmarcar tudo","description":{"one":"\u003cb\u003e1\u003c/b\u003e postagem selecionada.","other":"\u003cb\u003e{{count}}\u003c/b\u003e mensagens selecionadas."}}},"post":{"reply":"Em resposta a {{link}} por {{replyAvatar}} {{username}}","reply_topic":"Responder a {{link}}","quote_reply":"citar resposta","edit":"Editar {{link}}","edit_reason":"Razão:","post_number":"mensagem {{number}}","in_reply_to":"responder a","last_edited_on":"mensagem editada pela última vez em","reply_as_new_topic":"Responder como um novo Tópico","continue_discussion":"Continuar a discussão desde {{postLink}}:","follow_quote":"ir para a mensagem citada","show_full":"Mostrar Post Completo","show_hidden":"Ver conteúdo ocultado.","deleted_by_author":{"one":"(postagens abandonadas pelo autor, serão removidas automaticamente em %{count} hora a menos que forem sinalizadas)","other":"(mensagens abandonadas pelo autor, serão removidas automaticamente em %{count} horas a menos que sejam sinalizadas)"},"expand_collapse":"expandir/encolher","gap":{"one":"1 post ocultado","other":"{{count}} posts ocultados"},"more_links":"{{count}} mais...","unread":"Post não lido","has_replies":{"one":"Resposta","other":"Respostas"},"errors":{"create":"Desculpe, houve um erro ao criar a sua mensagem. Por favor, tente outra vez.","edit":"Desculpe, houve um erro ao editar a sua mensagem. Por favor, tente outra vez.","upload":"Desculpe, houve um erro ao enviar esse ficheiro. Por favor, tente outra vez.","attachment_too_large":"Desculpe, o ficheiro que está a enviar é muito grande (o tamanho máximo permitido é {{max_size_kb}}kb).","image_too_large":"Desculpe, o ficheiro que está a enviar é muito grande (o tamanho máximo é {{max_size_kb}}kb), por favor diminua-o e tente novamente.","too_many_uploads":"Desculpe, apenas pode enviar um ficheiro de cada vez.","upload_not_authorized":"Desculpe, o tipo de ficheiro que está a enviar não está autorizado (extensões autorizadas: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Desculpe, novos utilizadores não podem enviar imagens.","attachment_upload_not_allowed_for_new_user":"Desculpe, utilizadores novos não podem enviar anexos."},"abandon":{"confirm":"Tem a certeza que quer abandonar o seu post?","no_value":"Não, manter","yes_value":"Sim, abandonar"},"wiki":{"about":"este post é um wiki; utilizadores comuns podem editá-lo"},"archetypes":{"save":"Guardar as Opções"},"controls":{"reply":"começa a compor uma resposta a este tópico","like":"gostar deste tópico","has_liked":"gostaste deste post","undo_like":"desfazer gosto","edit":"editar este tópico","edit_anonymous":"Desculpe, mas necessita de ter sessão iniciada para editar este post.","flag":"denunciar privadamente este post para consideração ou enviar uma notificação privada sobre este","delete":"apagar esta mensagem","undelete":"repor esta mensagem","share":"partilhar um link para esta mensagem","more":"Mais","delete_replies":{"confirm":{"one":"Você também quer remover a resposta direta a esta postagem?","other":"Também quer remover as {{count}} respostas diretas a esta mensagem?"},"yes_value":"Sim, remover as respostas também","no_value":"Não, somente esta mensagem"},"admin":"acções administrativas de post","wiki":"Wiki post","unwiki":"Apresentar post como Wiki"},"actions":{"flag":"Sinalização","defer_flags":{"one":"Diferir denúncia","other":"Diferir denúncias"},"it_too":{"off_topic":"Sinalizar também","spam":"Sinalizar também","inappropriate":"Sinalizar também","custom_flag":"Sinalizar também","bookmark":"Adicionar marcador também","like":"Dê um Gosto também","vote":"Vote neste também"},"undo":{"off_topic":"Retirar sinalização","spam":"Retirar sinalização","inappropriate":"Retirar sinalização","bookmark":"Remover marcador","like":"Retirar gosto","vote":"Retirar votar"},"people":{"off_topic":"{{icons}} denunciar isto como off-topic","spam":"{{icons}} denunciar isto como spam","inappropriate":"{{icons}} denunciar isto como inapropriado","notify_moderators":"{{icons}} notificaram os moderadores","notify_moderators_with_url":"{{icons}} \u003ca href='{{postUrl}}'\u003enotificaram os moderadores\u003c/a\u003e","notify_user":"{{icons}} enviou uma mensagem particular","notify_user_with_url":"{{icons}} enviou uma \u003ca href='{{postUrl}}'\u003emensagem particular\u003c/a\u003e","bookmark":"{{icons}} adicionaram marcador a isto","like":"{{icons}} gostaram disto","vote":"{{icons}} votaram nisto"},"by_you":{"off_topic":"Sinalizou isto como off-topic","spam":"Sinalizou isto como spam","inappropriate":"Sinalizou isto como inapropriado","notify_moderators":"Sinalizou isto para moderação","notify_user":"Enviou uma mensagem particular para este utilizador","bookmark":"Adicionou um marcador para esta mensagem","like":"Gostou disto","vote":"Votou nesta mensagem"},"by_you_and_others":{"off_topic":{"one":"Você e mais 1 pessoa sinalizaram isto como off-topic","other":"{{count}} pessoas sinalizaram isto como off-topic, contando consigo"},"spam":{"one":"Você e mais 1 pessoa sinalizaram isto como spam","other":"{{count}} pessoas sinalizaram isto como spam, contando consigo"},"inappropriate":{"one":"Você e mais 1 pessoa sinalizaram isto como inapropriado","other":"{{count}} pessoas sinalizaram isto como inapropriado, contando consigo"},"notify_moderators":{"one":"Você e mais 1 pessoa sinalizaram isto para moderação","other":"{{count}} pessoas sinalizaram isto para moderação, contando consigo"},"notify_user":{"one":"Você e mais 1 pessoa enviaram mensagens particulares para este usuário","other":"{{count}} pessoas enviaram mensagens particulares para este utilizador, contando consigo"},"bookmark":{"one":"Você e mais 1 pessoa adicionaram um marcador a esta postagem","other":"{{count}} adicionaram um marcador a esta mensagem, contando consigo"},"like":{"one":"Você e mais 1 pessoa curtiu isto","other":"{{count}} pessoas gostaram disto, contando consigo"},"vote":{"one":"Você e mais 1 pessoa votaram nesta postagem","other":"{{count}} pessoas votaram nesta mensagem, contando consigo"}},"by_others":{"off_topic":{"one":"1 pessoa sinalizou isto como off-topic","other":"{{count}} pessoas sinalizaram isto como off-topic"},"spam":{"one":"1 pessoa sinalizou isto como spam","other":"{{count}} pessoas sinalizaram isto como spam"},"inappropriate":{"one":"1 pessoa sinalizou isto como inapropriado","other":"{{count}} pessoas sinalizaram isto como inapropriado"},"notify_moderators":{"one":"1 pessoa sinalizou isto para moderação","other":"{{count}} pessoas sinalizaram isto para moderação"},"notify_user":{"one":"1 pessoa enviou mensagem particular para este usuário","other":"{{count}} enviaram mensagem particular para este utilizador"},"bookmark":{"one":"1 pessoa adicionou um marcador a esta postagem","other":"{{count}} pessoas adicionaram um marcador a esta mensagem"},"like":{"one":"1 pessoa deu curtiu esta postagem","other":"{{count}} pessoas gostaram desta mensagem"},"vote":{"one":"1 pessoa votou nesta postagem","other":"{{count}} pessoas votaram nesta mensagem"}}},"edits":{"one":"1 edição","other":"{{count}} edições","zero":"sem edições"},"delete":{"confirm":{"one":"Tem certeza que quer apagar esta postagem?","other":"Tem certeza que quer apagar todos essas mensagens?"}},"revisions":{"controls":{"first":"Primeira revisão","previous":"Revisão anterior","next":"Próximo revisão","last":"Última revisão","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e vs \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Markdown"}},"details":{"edited_by":"Editado por"}}},"category":{"can":"pode\u0026hellip; ","none":"(sem categoria)","choose":"Selecione uma category\u0026hellip;","edit":"editar","edit_long":"Editar","view":"Visualizar Tópicos na Categoria","general":"Geral","settings":"Configurações","delete":"Apagar Categoria","create":"Criar Categoria","save":"Guardar Categoria","creation_error":"Houve um erro durante a criação da categoria.","save_error":"Houve um erro ao guardar a categoria.","name":"Nome da Categoria","description":"Descrição","topic":"tópico da categoria","logo":"Logótipo da Categoria","background_image":"Imagem de Fundo da Categoria","badge_colors":"Cores da miniatura","background_color":"Cor de fundo","foreground_color":"Cor frontal","name_placeholder":"Máximo de uma ou duas palavras","color_placeholder":"Qualquer cor web","delete_confirm":"Tem certeza que quer apagar esta categoria?","delete_error":"Houve um erro ao apagar a categoria.","list":"Lista de Categorias","no_description":"Por favor adicione uma descrição para este categoria.","change_in_category_topic":"Editar Descrição","already_used":"Esta cor já foi usada para outra categoria","security":"Segurança","images":"Imagens","auto_close_label":"Fechar automaticamente tópicos depois de:","auto_close_units":"horas","email_in":"Endereço personalizado de entrada de email:","email_in_allow_strangers":"Aceitar emails de utilizadores anónimos sem conta","email_in_disabled":"Publicar tópicos novos via email está desactivado nas Definições do Site. Para permitir a publicação de novos tópicos por email,","email_in_disabled_click":"active a definição \"email in\".","edit_permissions":"Editar Permissões","add_permission":"Adicionar Permissões","this_year":"este ano","position":"posição","default_position":"Posição Padrão","position_disabled":"As categorias serão apresentadas por ordem de actividade. Para controlar a ordenação das categorias nas listas,","position_disabled_click":"active a definição \"categoria em posição fixa\".","parent":"Categoria-Mãe","notifications":{"watching":{"title":"Vigiar","description":"Irá vigiar automaticamente todos os tópicos novos nestas categorias. Será notificado de todos os posts e tópicos novos, além disso será apresentada uma contagem de posts novos e não lidos junto da listagem de tópicos."},"tracking":{"title":"Acompanhar","description":"Irá acompanhar automaticamente todos os tópicos novos nestas categorias. Será apresentada uma contagem de posts novos e não lidos na listagem de tópicos."},"regular":{"title":"Normal","description":"Será notificado apenas se alguém mencionar o seu @nome ou responder ao seu post."},"muted":{"title":"Silenciar","description":"Não será notificado relativamente a nada deste tópico, e não aparecerão no seu separador de não lidos."}}},"flagging":{"title":"Porque está a denunciar este post em privado?","action":"Sinalizar Postagem","take_action":"Tomar Atitude","notify_action":"Mensagem privada","delete_spammer":"Apagar Spammer","delete_confirm":"Vai apagar \u003cb\u003e%{posts}\u003c/b\u003e mensagens e \u003cb\u003e%{topics}\u003c/b\u003e tópicos deste utilizador, remover a sua conta, bloquear acessos do seu endereço IP \u003cb\u003e%{ip_address}\u003c/b\u003e, e adicionar o seu endereço de email \u003cb\u003e%{email}\u003c/b\u003e a uma lista negra. Tem a certeza que este utilizador é de facto um spammer?","yes_delete_spammer":"Sim, Apagar Spammer","submit_tooltip":"Submeter a denúncia privada","take_action_tooltip":"Atingir imediatamente o limite de denúncias, em vez de esperar por mais denúncias da comunidade","cant":"Desculpe, não é possível colocar uma sinalização neste momento.","custom_placeholder_notify_user":"Porque esta mensagem requer que fale diretamente e privativamente com este utilizador? Seja específico, construtivo e sempre gentil.","custom_placeholder_notify_moderators":"Porque esta mensagem requer atenção do moderador? Diga especificamente como isto te preocupou e forneça links relevantes, se possível.","custom_message":{"at_least":"insira pelo menos {{n}} caracteres","more":"{{n}} em falta...","left":"{{n}} restantes"}},"flagging_topic":{"title":"Porque está a denunciar este tópico em privado?","action":"Denunciar Tópico","notify_action":"Mensagem privada"},"topic_map":{"title":"Sumário de Tópico","links_shown":"mostrar todas as {{totalLinks}} ligações...","clicks":{"one":"1 clique","other":"%{count} cliques"}},"topic_statuses":{"locked":{"help":"Este tópico está fechado; já não são aceites novas respostas"},"unpinned":{"title":"Desmarcadao","help":"Este tópico está desmarcado; será mostrado na ordem predefinida"},"pinned_globally":{"title":"Marcado Globalmente","help":"Este tópico esta marcado globalmente; ser mostrado no topo de todas as listas"},"pinned":{"title":"Marcado","help":"Este tópico está marcado; será mostrada no topo da sua categoria"},"archived":{"help":"Este tópico está arquivado; está bloqueado e não pode ser alterado"},"invisible":{"help":"Este tópico está invisível; não será apresentado na listagem de tópicos e apenas pode ser acedido através de um link directo"}},"posts":"Mensagens","posts_lowercase":"posts","posts_long":"há {{number}} mensagens neste tópico","original_post":"Mensagem Original","views":"Visualizações","views_lowercase":"visualizações","replies":"Respostas","views_long":"este tópico foi visto {{number}} vezes","activity":"Atividade","likes":"Gostos","likes_lowercase":"gostos","likes_long":"há {{number}} gostos neste tópico","users":"Utilizadores","users_lowercase":"utilizadores","category_title":"Categoria","history":"Histórico","changed_by":"por {{author}}","categories_list":"Lista de Categorias","filters":{"with_topics":"%{filter} tópicos","with_category":"%{filter} %{category} tópicos","latest":{"title":"Populares","help":"tópicos com posts recentes"},"hot":{"title":"Quente","help":"uma seleção dos tópicos mais quentes"},"starred":{"title":"Favoritos"},"read":{"title":"Lido","help":"tópicos que leu"},"categories":{"title":"Categorias","title_in":"Categoria - {{categoryName}}","help":"todos os tópicos agrupados por categoria"},"unread":{"title":{"zero":"Não lido","one":"Não lido (1)","other":"Não lidos ({{count}})"},"help":"tópicos que está actualmente a vigiar ou a acompanhar com posts não lidos","lower_title_with_count":{"one":"1 não lido","other":"{{count}} não lidos"}},"new":{"lower_title_with_count":{"one":"1 novo","other":"{{count}} novos"},"lower_title":"novo","title":{"zero":"Novo","one":"Novo (1)","other":"Novos ({{count}})"},"help":"tópicos criados nos últimos dias"},"posted":{"title":"Minhas mensagens","help":"tópicos nos quais enviou mensagem"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"tópicos populares na categoria {{categoryName}}"},"top":{"title":"Top","help":"os tópicos mais activos no último ano, mês, semana ou dia","yearly":{"title":"Top Anual"},"monthly":{"title":"Top Mensal"},"weekly":{"title":"Top Semanal"},"daily":{"title":"Top Diário"},"this_year":"Este ano","this_month":"Este mês","this_week":"Esta semana","today":"Hoje","other_periods":"ver mais tópicos populares"}},"permission_types":{"full":"Criar / Responder / Ver","create_post":"Responder / Ver","readonly":"Ver"},"type_to_filter":"escreva para filtrar...","admin":{"title":"Discourse Admin","moderator":"Moderador","dashboard":{"title":"Painel Administrativo","last_updated":"Painel atualizado em:","version":"Versão","up_to_date":"Está atualizado!","critical_available":"Uma atualização crítica está disponível.","updates_available":"Atualizações estão disponíveis.","please_upgrade":"Por favor, atualize!","no_check_performed":"Não foi feita verificação por atualizações. Certifique-se de o sidekiq está em execução.","stale_data":"Não foi feita verificação por atualizações ultimamente. Certifique-se de que o sidekiq está em execução.","version_check_pending":"Parece que atualizou recentemente. Fantástico!","installed_version":"Instalado","latest_version":"Última versão","problems_found":"Alguns problemas foram encontrados na sua instalação do Discourse:","last_checked":"Última verificação","refresh_problems":"Atualizar","no_problems":"Nenhum problema encontrado.","moderators":"Moderadores:","admins":"Admins:","blocked":"Bloqueado:","suspended":"Suspenso: ","private_messages_short":"MPs","private_messages_title":"Mensagens Particulares","reports":{"today":"Hoje","yesterday":"Ontem","last_7_days":"Últimos 7 Dias","last_30_days":"Últimos 30 Dias","all_time":"Desde Sempre","7_days_ago":"7 Dias Atrás","30_days_ago":"30 Dias Atrás","all":"Tudo","view_table":"Visualizar como Tabela","view_chart":"Visualizar como Gráfico de Barras"}},"commits":{"latest_changes":"Últimas atualizações: atualize com frequência!","by":"por"},"flags":{"title":"Sinalizações","old":"Antigo","active":"Ativo","agree":"Aceitar","agree_title":"Confirmar esta denúncia como válida e correcta","agree_flag_modal_title":"Aceitar e...","agree_flag_hide_post":"Aceitar (esconder post + enviar MP)","agree_flag_hide_post_title":"Esconder este post e enviar automaticamente uma mensagem privada ao utilizador solicitando a edição do post com urgência","agree_flag":"Aceitar a denúncia","agree_flag_title":"Aceitar a denúncia e manter o post inalterado","defer_flag":"Diferir","defer_flag_title":"Remover esta denúncia; neste momento não requer qualquer acção.","delete":"Apagar","delete_title":"Apagar o post associado a esta denúncia.","delete_post_defer_flag":"Apagar post e diferir a denúncia","delete_post_defer_flag_title":"Apagar post; apagar o tópico se se tratar do primeiro post","delete_post_agree_flag":"Apagar post e aceitar a denúncia","delete_post_agree_flag_title":"Apagar post; apagar tópico se se tratar do primeiro post","delete_flag_modal_title":"Apagar e...","delete_spammer":"Apagar Spammer","delete_spammer_title":"Remover utilizador e todos os posts e tópicos do mesmo.","disagree_flag_unhide_post":"Rejeitar (exibir post)","disagree_flag_unhide_post_title":"Remover qualquer denúncia deste post e tornar o post novamente visível","disagree_flag":"Rejeitar","disagree_flag_title":"Negar esta denúncia como invalida ou incorrecta","clear_topic_flags":"Concluído","clear_topic_flags_title":"Este tópico foi investigado e os problemas foram resolvidos. Clique Concluído para remover as denúncias.","more":"(mais respostas...)","dispositions":{"agreed":"aceite","disagreed":"rejeitado","deferred":"diferido"},"flagged_by":"Sinalizado por","resolved_by":"Resolvido por","took_action":"Tomou acção","system":"Sistema","error":"Aconteceu um erro","reply_message":"Responder","no_results":"Não há sinalizações.","topic_flagged":"Este \u003cstrong\u003etopic\u003c/strong\u003e foi denunciado.","visit_topic":"Visitar tópico para tomar medidas","was_edited":"Post foi editado após a primeira denúncia","summary":{"action_type_3":{"one":"off-topic","other":"off-topic x{{count}}"},"action_type_4":{"one":"inapropriado","other":"inapropriado x{{count}}"},"action_type_6":{"one":"customizado","other":"customizados x{{count}}"},"action_type_7":{"one":"personalizado","other":"personalizado x{{count}}"},"action_type_8":{"one":"spam","other":"spam x{{count}}"}}},"groups":{"primary":"Grupo Primário","no_primary":"(nenhum grupo primário)","title":"Grupos","edit":"Editar Grupos","refresh":"Actualizar","new":"Novo","selector_placeholder":"adicionar utilizadores","name_placeholder":"Nome do grupo, sem espaços, regras iguais ao nome de utilizador","about":"Editar participação no grupo e nomes aqui","group_members":"Membros do grupo","delete":"Apagar","delete_confirm":"Apagar este grupo?","delete_failed":"Impossível apagar grupo. Se se trata de um grupo automático, não pode ser eliminado."},"api":{"generate_master":"Gerar chave API Master","none":"Não existem chave API activas neste momento.","user":"Utilizador","title":"API","key":"Chave API","generate":"Gerar","regenerate":"Regenerar","revoke":"Revogar","confirm_regen":"Tem a certeza que quer substituir essa chave API por uma nova?","confirm_revoke":"Tem a certeza que quer revogar essa chave?","info_html":"A sua chave de API permitirá a criação e edição de tópicos usando requests JSON.","all_users":"Todos os Utilizadores"},"backups":{"title":"Backups","menu":{"backups":"Backups","logs":"Logs"},"none":"Nenhum backup disponível.","read_only":{"enable":{"title":"Activar o modo apenas leitura","text":"Activa modo apenas leitura","confirm":"Tem a certeza que quer activar o modo apenas leitura?"},"disable":{"title":"Desactivar o modo apenas leitura","text":"Desactivar modo apenas leitura"}},"logs":{"none":"Nenhuns logs ainda..."},"columns":{"filename":"Nome do ficheiro","size":"Tamanho"},"upload":{"text":"CARREGAR","uploading":"CARREGANDO","success":"'{{filename}}' foi carregado com sucesso.","error":"Verificou-se um erro no carregamento de '{{filename}}': {{message}}"},"operations":{"is_running":"Existe actualmente uma operação em andamento...","failed":"A {{operation}} falhou. Por favor verifique os logs.","cancel":{"text":"Cancelar","title":"Cancelar a operação actual","confirm":"Tem a certeza que deseja cancelar a operação actual?"},"backup":{"text":"Backup","title":"Criar um backup","confirm":"Deseja criar um novo backup?","without_uploads":"Sim (sem carregamento)"},"download":{"text":"Descarregar","title":"Descarregar o backup"},"destroy":{"text":"Apagar","title":"Remover o backup","confirm":"Tem a certeza que deseja destruir o backup?"},"restore":{"is_disabled":"Opção de restauro encontra-se desactivada nas definições do site.","text":"Restaurar","title":"Restaurar o backup","confirm":"Tem a certeza que deseja restaurar este backup?"},"rollback":{"text":"Reverter","title":"Reverter a base de dados para um estado anterior operacional","confirm":"Tem a certeza que deseja reverter a base de dados para um estado anterior operacional?"}}},"export_csv":{"users":{"text":"Exportar Utilizadores","title":"Exportar lista de utilizadores num ficheiro CSV."},"success":"Exportação foi iniciada, será notificado brevemente do progresso da mesma.","failed":"Exportação falhou. Por favor verifique os logs."},"customize":{"title":"Personalizar","long_title":"Personalizações do Site","header":"Cabeçalho","css":"Stylesheet","mobile_header":"Cabeçalho Mobile","mobile_css":"Folha de Estilos Mobile","override_default":"Sobrepor padrão?","enabled":"Habilitado?","preview":"pré-visualização","undo_preview":"remover pré-visualização","rescue_preview":"estilo padrão","explain_preview":"Ver o site com a folha de estilo personalizada","explain_undo_preview":"Voltar atrás para a actual folha de estilo personalizada activada","explain_rescue_preview":"Ver o site com a folha de estilo padrão","save":"Guardar","new":"Novo","new_style":"Novo Estilo","delete":"Apagar","delete_confirm":"Apagar esta personalização?","about":"Modificar folha de estilo CSS e cabeçalhos HTML no site. Adicionar personalização para iniciar.","color":"Cor","opacity":"Opacidade","copy":"Copiar","css_html":{"title":"CSS/HTML","long_title":"Personalizações CSS e HTML"},"colors":{"title":"Cores","long_title":"Esquemas de cores","about":"Modificar as cores usadas no site sem escrever CSS. Adicionar um esquema para iniciar.","new_name":"Novo Esquema de Cores","copy_name_prefix":"Cópia","delete_confirm":"Apagar este esquema de cor?","undo":"anular","undo_title":"Anular alterações a esta cor desde a última gravação.","revert":"reverter","revert_title":"Repor esta cor para o esquema de cor padrão do Discourse.","primary":{"name":"primária","description":"A maioria do texto, ícones, e margens."},"secondary":{"name":"secundária","description":"A principal cor de fundo, e cor do texto de alguns botões."},"tertiary":{"name":"terciária","description":"Links, alguns botões, notificações, e cores tônicas."},"quaternary":{"name":"quaternária","description":"Links de navegação."},"header_background":{"name":"fundo do cabeçalho","description":"Cor de fundo do cabeçalho do site."},"header_primary":{"name":"cabeçalho primária","description":"Texto e ícones no cabeçalho do site."},"highlight":{"name":"destaque","description":"A cor de fundo de elementos destacados na página, tais como posts e tópicos."},"danger":{"name":"perigo","description":"Cor de destaque para acções como apagar posts e tópicos."},"success":{"name":"sucesso","description":"Usado para indicar que uma acção foi bem sucedida."},"love":{"name":"amor","description":"A cor do botão 'gosto'."}}},"email":{"title":"Email","settings":"Configurações","all":"Todos","sending_test":"A enviar Email de teste...","test_error":"Houve um problema no envio do email de teste. Por favor verifique novamente as suas definições de email, verifique se o seu host não está a bloquear conexões de email, e tente novamente.","sent":"Enviado","skipped":"Ignorado","sent_at":"Enviado para ","time":"Tempo","user":"Utilizador","email_type":"Tipo de Email","to_address":"Para (endereço)","test_email_address":"endereço de email para testar","send_test":"Enviar Email de Teste","sent_test":"enviado!","delivery_method":"Método de Entrega","preview_digest":"Pré-vizualizar modo Digest","preview_digest_desc":"Esta é uma ferramenta para prever o conteúdo dos emails de resumo enviados a partir do seu forum.","refresh":"Atualizar","format":"Formato","html":"html","text":"texto","last_seen_user":"Último Utilizador Visto:","reply_key":"Chave de Resposta","skipped_reason":"Ignorar Motivo","logs":{"none":"Nenhuns logs encontrados.","filters":{"title":"Filtrar","user_placeholder":"nome de utilizador","address_placeholder":"name@example.com","type_placeholder":"resumo, subscrever...","skipped_reason_placeholder":"motivo"}}},"logs":{"title":"Logs","action":"Ação","created_at":"Criado","last_match_at":"Última Correspondência","match_count":"Resultados","ip_address":"IP","delete":"Apagar","edit":"Editar","save":"Guardar","screened_actions":{"block":"bloquear","do_nothing":"não fazer nada"},"staff_actions":{"title":"Ações do Staff","instructions":"Selecione os nomes de utilizador e as ações para filtrar a lista. Clique nos avatares para ir para as páginas dos utilizadores.","clear_filters":"Mostrar Tudo","staff_user":"Utilizador do Staff","target_user":"Utilizador Destino","subject":"Assunto","when":"Quando","context":"Contexto","details":"Detalhes","previous_value":"Anterior","new_value":"Nova","diff":"Diferenças","show":"Exibir","modal_title":"Detalhes","no_previous":"Não há valor anterior.","deleted":"Não há valor novo. O registo foi removido.","actions":{"delete_user":"removeu utilizador","change_trust_level":"modificou nível de confiança","change_site_setting":"alterar configurações do site","change_site_customization":"alterar personalização do site","delete_site_customization":"remover personalização do site","suspend_user":"utilizador suspenso","unsuspend_user":"utilizador não suspenso"}},"screened_emails":{"title":"Emails Filtrados","description":"Quando alguém tenta criar uma nova conta, os seguintes endereços de email serão verificados e o registo será bloqueado, ou outra ação será executada.","email":"Endereço de Email","actions":{"allow":"Permitir"}},"screened_urls":{"title":"URLs Filtrados","description":"Os URLs listados aqui foram usados em mensagens de utilizadores que foram identificados como spammers.","url":"URL","domain":"Domínio"},"screened_ips":{"title":"IPs Filtrados","description":"Endereços IP que estão sob observação. Utilize \"Permitir\" para aprovar os endereços IP.","delete_confirm":"Tem a certeza que quer remover esta regra para %{ip_address}?","actions":{"block":"Bloquear","do_nothing":"Permitir"},"form":{"label":"Novo:","ip_address":"Endereço IP","add":"Adicionar"}},"logster":{"title":"Erros de logo de dados"}},"users":{"title":"Utilizadores","create":"Adicionar Utilizador Admin","last_emailed":"Último email enviado","not_found":"Desculpe, esse nome de utilizador não existe no nosso sistema.","active":"Ativo","nav":{"new":"Novos","active":"Ativos","pending":"Pendentes","admins":"Administradores","moderators":"Moderadores","suspended":"Suspenso","blocked":"Bloqueados"},"approved":"Aprovado?","approved_selected":{"one":"aprovar usuário","other":"aprovar utilizadores ({{count}})"},"reject_selected":{"one":"rejeitar usuário","other":"rejeitar utilizadores ({{count}})"},"titles":{"active":"Utilizadores Ativos","new":"Utilizadores Novos","pending":"Utilizadores com Confirmação Pendente","newuser":"Utilizadores no Nível de Confiança 0 (Utilizador Novo)","basic":"Utilizadores no Nível de Confiança 1 (Utilizador Básico)","regular":"Utilizadores no Nível de Confiança 2 (Utilizador Regular)","elder":"Utilizadores no Nível de Confiança 4 (Cavaleiro)","admins":"Utilizadores Administradores","moderators":"Moderadores","blocked":"Utilizadores Bloqueados","suspended":"Utilizadores Suspensos"},"reject_successful":{"one":"1 usuário foi rejeitado com sucesso.","other":"%{count} utilizadores foram rejeitados com sucesso."},"reject_failures":{"one":"Falha ao rejeitar 1 usuário.","other":"Falha ao rejeitar %{count} utilizadores."}},"user":{"suspend_failed":"Houve um erro ao suspender este utilizador {{error}}","unsuspend_failed":"Houve um erro ao respirar a suspensão a este utilizador {{error}}","suspend_duration":"Durante quanto tempo o utilizador estará suspenso?","suspend_duration_units":"(dias)","suspend_reason_label":"Qual o motivo da suspensão? Este texto \u003cb\u003eestará visível para todos\u003c/b\u003e na página do perfil do utilizador, e será mostrada ao utilizador quando tentar o login. Mantenha-o breve.","suspend_reason":"Razão","suspended_by":"Suspenso por","delete_all_posts":"Apagar todas as mensagens","delete_all_posts_confirm":"Está prestes a apagar %{posts} mensagens e %{topics} tópicos. Tem a certeza de que quer continuar?","suspend":"Suspenso","unsuspend":"Não suspenso","suspended":"Suspenso?","moderator":"Moderador?","admin":"Admin?","blocked":"Bloqueado?","show_admin_profile":"Admin","edit_title":"Editar Título","save_title":"Guardar Título","refresh_browsers":"Forçar atualização da página no browser","refresh_browsers_message":"Mensagem enviada para todos os clientes!","show_public_profile":"Mostrar Perfil Público","impersonate":"Personificar","ip_lookup":"Pesquisa de IP","log_out":"Terminar sessão","logged_out":"Sessão do utilizador terminada em todos os utilizadores","revoke_admin":"Revogar Admin","grant_admin":"Conceder Admin","revoke_moderation":"Revogar Moderação","grant_moderation":"Conceder Moderação","unblock":"Desbloquear","block":"Bloquear","reputation":"Reputação","permissions":"Permissões","activity":"Atividade","like_count":"Gostos Dados / Recebidos","last_100_days":"nos últimos 100 dias","private_topics_count":"Tópicos Privados","posts_read_count":"Mensagens lidas","post_count":"Mensagens criadas","topics_entered":"Tópicos Vistos","flags_given_count":"Sinalizações dadas","flags_received_count":"Sinalizações recebidas","flags_given_received_count":"Denúncias Dadas / Recebidas","approve":"Aprovar","approved_by":"aprovado por","approve_success":"Utilizador aprovado e email enviado com instruções de ativação.","approve_bulk_success":"Sucesso! Todos os utilizadores selecionados foram aprovados e notificados.","time_read":"Tempo de leitura","delete":"Apagar Utilizador","delete_forbidden_because_staff":"Administradores e moderadores não podem ser eleminados.","delete_forbidden":{"one":"Utilizadores não podem ser eliminados se tiverem posts. Apague todos os posts antes de eliminar o utilizador. (Posts com mais de %{count} dia de existência não pode ser apagado.)","other":"Utilizadores não podem ser eliminados se tiverem posts. Apague todos os posts antes de eliminar o utilizador. (Posts com mais de %{count} dias de existência não podem ser apagados.)"},"cant_delete_all_posts":{"one":"Não é possível apagar todos os posts. Alguns posts existem há mais %{count} dia. (The delete_user_max_post_age setting.)","other":"Não é possível apagar todos os posts. Alguns posts existem há mais %{count} dias. (The delete_user_max_post_age setting.)"},"cant_delete_all_too_many_posts":{"one":"Não é possível apagar todos os posts porque o utilizador tem mais do que 1 post. (delete_all_posts_max)","other":"Não é possível apagar todos os posts porque o utilizador tem mais do que %{count} posts. (delete_all_posts_max)"},"delete_confirm":"Tem a CERTEZA que deseja eliminar este utilizador? Esta acção é permanente!","delete_and_block":"Eliminar e \u003cb\u003ebloquear\u003cb\u003e este endereço de email e IP","delete_dont_block":"Apenas eliminar","deleted":"O utilizador foi apagado.","delete_failed":"Houve um erro ao apagar o utilizador. Certifique-se de que todas as suas mensagens foram apagadas antes de tentar apagá-lo.","send_activation_email":"Enviar Email de Ativação","activation_email_sent":"Um email de ativação foi enviado.","send_activation_email_failed":"Houve um problema ao enviar um novo email de ativação. %{error}","activate":"Ativar Conta","activate_failed":"Houve um problema ao tornar o utilizador ativo.","deactivate_account":"Desativar Conta","deactivate_failed":"Houve um problema ao desativar o utilizador.","unblock_failed":"Houve um problema ao desbloquear o utilizador.","block_failed":"Houve um problema ao bloquear o utilizador.","deactivate_explanation":"Um utilizador desativado deve revalidar o seu email.","suspended_explanation":"Um utilizador suspenso não pode fazer login.","block_explanation":"Um utilizador bloqueado não pode enviar mensagens ou iniciar tópicos.","trust_level_change_failed":"Houve um problema ao trocar o nível de confiança do utilizador.","suspend_modal_title":"Utilizador Suspenso","trust_level_2_users":"Utilizadores no Nível 2 de Confiança","trust_level_3_requirements":"Nível 3 de Confiança: Requisitos","tl3_requirements":{"title":"Requisitos para o Nível 3 de Confiança","table_title":"Nos últimos 100 dias:","value_heading":"Valor","requirement_heading":"Requisito","visits":"Visitas","days":"dias","topics_replied_to":"Respostas a Tópicos","topics_viewed":"Tópicos Vistos","topics_viewed_all_time":"Tópicos Vistos (desde sempre)","posts_read":"Posts Lidos","posts_read_all_time":"Posts Lidos (desde sempre)","flagged_posts":"Posts Denunciados","flagged_by_users":"Utilizadores Que Denunciaram","likes_given":"Gostos Dados","likes_received":"Gostos Recebidos","qualifies":"Qualifica-se para nível 3 de confiança.","will_be_promoted":"Será promovido dentro de 24 horas.","does_not_qualify":"Não se qualifica para o nível 3 de confiança."},"sso":{"external_id":"ID Externo","external_username":"Nome de utilizador","external_name":"Nome","external_email":"Email","external_avatar_url":"URL do Avatar"}},"site_content":{"none":"Escolher um tipo de conteúdo para começar a editar.","title":"Conteúdo","edit":"Editar Conteúdo do Site"},"site_settings":{"show_overriden":"Apenas mostrar valores alterados","title":"Configurações do Site","reset":"repor","none":"nenhum","no_results":"Não foi encontrado nenhum resultado.","clear_filter":"Remover","categories":{"all_results":"Todos","required":"Necessário","basic":"Configuração básica","users":"Utilizadores","posting":"Escrever mensagem","email":"Email","files":"Ficheiros","trust":"Níveis de Confiança","security":"Segurança","onebox":"Onebox","seo":"SEO","spam":"Spam","rate_limits":"Limites de classificação","developer":"Programador","embedding":"Incorporação","legal":"Legal","uncategorized":"Outro","backups":"Backups","login":"Entrar"}},"badges":{"new":"Novo","name":"Nome","display_name":"Apresentar Nome","description":"Descrição","badge_grouping":"Grupo","granted_by":"Concedido Por","granted_at":"Concedido Em","save":"Guardar","delete":"Apagar","revoke":"Revogar","grant":"Conceder","multiple_grant":"Pode ser concedido diversas vezes","icon":"Icon","trigger_type":{"none":"Actualizado diariamente","post_action":"Quando um utilizador actua num post","post_revision":"Quando um utilizador edita ou cria um post","trust_level_change":"Quando um utilizador muda de nível de confiança","user_change":"Quando um utilizador é editado ou criado"}}},"lightbox":{"download":"descarregar"},"keyboard_shortcuts_help":{"title":"Atalhos de Teclado","jump_to":{"title":"Ir Para"},"navigation":{"title":"Navegação"},"application":{"title":"Aplicação"},"actions":{"title":"Acções"}},"badges":{"multiple_grant":"conceder múltiplas vezes?","badge_grouping":{"getting_started":{"name":"Dar Início"},"community":{"name":"Comunidade"},"trust_level":{"name":"Nível de Confiança"},"other":{"name":"Outro"}},"badge":{"editor":{"name":"Editor","description":"Primeira edição de um post"},"welcome":{"name":"Bem-vindo","description":"Recebeu um gosto"},"autobiographer":{"name":"Autobiógrafo"},"first_like":{"name":"Primeiro Gosto","description":"Gostou de um post"},"first_flag":{"name":"Primeira Denúncia","description":"Denunciou um post"},"first_share":{"name":"Primeira Partilha","description":"Partilhou um post"},"first_link":{"name":"Primeiro Link","description":"Adicionou um link interno para outro tópico"},"first_quote":{"name":"Primeira Citação","description":"Citou um utilizador"},"read_guidelines":{"name":"Ler Directrizes","description":"Leu as \u003ca href=\"/guidelines\"\u003edirectrizes da comunidade\u003c/a\u003e"},"reader":{"name":"Leitor","description":"Leu todos os posts num tópico com mais de 100 posts"}}}}}};
I18n.locale = 'pt';
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
// locale : portuguese (pt)
// author : Jefferson : https://github.com/jalex79

(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define(['moment'], factory); // AMD
    } else if (typeof exports === 'object') {
        module.exports = factory(require('../moment')); // Node
    } else {
        factory(window.moment); // Browser global
    }
}(function (moment) {
    return moment.defineLocale('pt', {
        months : "janeiro_fevereiro_março_abril_maio_junho_julho_agosto_setembro_outubro_novembro_dezembro".split("_"),
        monthsShort : "jan_fev_mar_abr_mai_jun_jul_ago_set_out_nov_dez".split("_"),
        weekdays : "domingo_segunda-feira_terça-feira_quarta-feira_quinta-feira_sexta-feira_sábado".split("_"),
        weekdaysShort : "dom_seg_ter_qua_qui_sex_sáb".split("_"),
        weekdaysMin : "dom_2ª_3ª_4ª_5ª_6ª_sáb".split("_"),
        longDateFormat : {
            LT : "HH:mm",
            L : "DD/MM/YYYY",
            LL : "D [de] MMMM [de] YYYY",
            LLL : "D [de] MMMM [de] YYYY LT",
            LLLL : "dddd, D [de] MMMM [de] YYYY LT"
        },
        calendar : {
            sameDay: '[Hoje às] LT',
            nextDay: '[Amanhã às] LT',
            nextWeek: 'dddd [às] LT',
            lastDay: '[Ontem às] LT',
            lastWeek: function () {
                return (this.day() === 0 || this.day() === 6) ?
                    '[Último] dddd [às] LT' : // Saturday + Sunday
                    '[Última] dddd [às] LT'; // Monday - Friday
            },
            sameElse: 'L'
        },
        relativeTime : {
            future : "em %s",
            past : "há %s",
            s : "segundos",
            m : "um minuto",
            mm : "%d minutos",
            h : "uma hora",
            hh : "%d horas",
            d : "um dia",
            dd : "%d dias",
            M : "um mês",
            MM : "%d meses",
            y : "um ano",
            yy : "%d anos"
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
moment.fn.longDate = function(){ return this.format('D de MMMM de YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
