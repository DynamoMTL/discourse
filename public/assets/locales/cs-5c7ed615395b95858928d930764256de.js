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
MessageFormat.locale.cs = function (n) {
  if (n == 1) {
    return 'one';
  }
  if (n == 2 || n == 3 || n == 4) {
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
    })({"topic.read_more_MF" : function(){ return "Invalid Format: Expected \"\\\\#\", \"\\\\u\", \"\\\\{\", \"\\\\}\", \"{\" or [^{}\\\\\\0-\\x1F\u007F \\t\\n\\r] but \"\\\\\" found.";}});I18n.translations = {"cs":{"js":{"number":{"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"bajt","few":"bajty","other":"bajtů"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}}},"dates":{"tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c 1s","few":"\u003c %{count}s","other":"\u003c %{count}s"},"x_seconds":{"one":"1s","few":"%{count}s","other":"%{count}s"},"less_than_x_minutes":{"one":"\u003c 1m","few":"\u003c %{count}m","other":"\u003c %{count}m"},"x_minutes":{"one":"1m","few":"%{count}m","other":"%{count}m"},"about_x_hours":{"one":"1h","few":"%{count}h","other":"%{count}h"},"x_days":{"one":"1d","few":"%{count}d","other":"%{count}d"},"about_x_years":{"one":"1r","few":"%{count}r","other":"%{count}let"},"over_x_years":{"one":"\u003e 1r","few":"\u003e %{count}r","other":"\u003e %{count}let"},"almost_x_years":{"one":"1r","few":"%{count}r","other":"%{count}let"},"date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"1 minuta","few":"%{count} minuty","other":"%{count} minut"},"x_hours":{"one":"1 hodina","few":"%{count} hodiny","other":"%{count} hodin"},"x_days":{"one":"1 den","few":"%{count} dny","other":"%{count} dní"}},"medium_with_ago":{"x_minutes":{"one":"před 1 minutou","few":"před %{count} minutami","other":"před %{count} minutami"},"x_hours":{"one":"před 1 hodinou","few":"před %{count} hodinami","other":"před %{count} hodinami"},"x_days":{"one":"před 1 dnem","few":"před %{count} dny","other":"před %{count} dny"}}},"share":{"topic":"sdílet odkaz na toto téma","post":"sdílet odkaz na příspěvek #%{postNumber}","close":"zavřít","twitter":"sdílet odkaz na Twitteru","facebook":"sdílet odkaz na Facebooku","google+":"sdílet odkaz na Google+","email":"odeslat odkaz emailem"},"edit":"upravit název a kategorii příspěvku","not_implemented":"Tato fičura ještě není implementovaná","no_value":"Ne","yes_value":"Ano","generic_error":"Bohužel nastala chyba.","generic_error_with_reason":"Nastala chyba: %{error}","age":"Věk","joined":"Účet vytvořen","admin_title":"Administrace","flags_title":"Nahlášení","show_more":"zobrazit více","links":"Odkazy","faq":"FAQ","privacy_policy":"Ochrana soukromí","mobile_view":"Mobilní verze","desktop_view":"Plná verze","you":"Vy","or":"nebo","now":"právě teď","read_more":"číst dále","more":"Více","less":"Méně","never":"nikdy","daily":"denně","weekly":"týdně","every_two_weeks":"jednou za 14 dní","max":"max","character_count":{"one":"{{count}} znak","few":"{{count}} znaky","other":"{{count}} znaků"},"in_n_seconds":{"one":"za 1 sekundu","few":"za {{count}} sekundy","other":"za {{count}} sekund"},"in_n_minutes":{"one":"za 1 minutu","few":"za {{count}} minuty","other":"za {{count}} minut"},"in_n_hours":{"one":"za 1 hodinu","few":"za {{count}} hodiny","other":"za {{count}} hodin"},"in_n_days":{"one":"za 1 den","few":"za {{count}} dny","other":"za {{count}} dní"},"suggested_topics":{"title":"Doporučená témata"},"bookmarks":{"not_logged_in":"Pro přidání záložky se musíte přihlásit.","created":"Záložka byla přidána.","not_bookmarked":"Tento příspěvek jste již četli. Klikněte pro přidání záložky.","last_read":"Toto je váš poslední přečtený příspěvek. Klikněte pro přidání záložky.","remove":"Odstranit záložku"},"preview":"ukázka","cancel":"zrušit","save":"Uložit změny","saving":"Ukládám...","saved":"Uloženo!","upload":"Obrázek","uploading":"Nahrávám...","uploaded":"Nahráno!","enable":"Zapnout","disable":"Vypnout","undo":"Zpět","choose_topic":{"none_found":"Žádná témata nenalezena.","title":{"search":"Hledat téma podle názvu, URL nebo ID:","placeholder":"sem napište název tématu"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e zaslal \u003ca href='{{topicUrl}}'\u003etéma\u003c/a\u003e","you_posted_topic":"Zaslal jste \u003ca href='{{topicUrl}}'\u003etéma\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e odpověděl na příspěvek \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"Odpověděl jste na příspěvek \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e přispěl do \u003ca href='{{topicUrl}}'\u003etématu\u003c/a\u003e","you_replied_to_topic":"Přispěl jste do \u003ca href='{{topicUrl}}'\u003etématu\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e zmínil uživatele \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e \u003ca href='{{user2Url}}'\u003evás\u003c/a\u003e zmínil","you_mentioned_user":"Zmínil jste uživatele \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Příspěvěk od \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Odesláno \u003ca href='{{userUrl}}'\u003evámi\u003c/a\u003e","sent_by_user":"Posláno uživatelem \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Posláno \u003ca href='{{userUrl}}'\u003evámi\u003c/a\u003e"},"groups":{"visible":"Skupina je viditelná pro všechny uživatele","title":{"one":"skupina","few":"skupiny","other":"skupiny"},"members":"Členové","posts":"Odpovědi","alias_levels":{"title":"Kdo může zmínit tuto skupinu jako @skupina?","nobody":"Nikdo","only_admins":"Pouze správci","mods_and_admins":"Pouze moderátoři a správci","members_mods_and_admins":"Pouze členové skupiny, moderátoři a správci","everyone":"Kdokoliv"}},"user_action_groups":{"1":"Rozdaných 'líbí se'","2":"Obdržených 'líbí se'","3":"Záložky","4":"Témata","5":"Odpovědi","6":"Odezvy ostatních","7":"Zmíňky","9":"Citace","10":"Oblíbené","11":"Editace","12":"Odeslané zprávy","13":"Přijaté zprávy"},"categories":{"all":"všechny kategorie","all_subcategories":"vše","no_subcategory":"žádné","category":"Kategorie","latest":"Aktuální","latest_by":"latest by","toggle_ordering":"Přepnout editaci pořadí","subcategories":"Podkategorie","topic_stats":"Počet nových témat.","topic_stat_sentence":{"one":"%{count} nové téma za posledních %{unit}.","few":"%{count} nová témata za posledních %{unit}.","other":"%{count} nových témat za posledních %{unit}."},"post_stats":"Počet nových příspěvků.","post_stat_sentence":{"one":"%{count} nový příspěvěk za posledních %{unit}.","few":"%{count} nové příspěvky za posledních %{unit}.","other":"%{count} nových příspěvků za posledních %{unit}."}},"user":{"said":"uživatel {{username}} řekl:","profile":"Profil","mute":"Ignorovat","edit":"Upravit nastavení","download_archive":"stáhnout archiv mých příspěvků","private_message":"Soukromé zprávy","private_messages":"Zprávy","activity_stream":"Aktivita","preferences":"Nastavení","bio":"O mně","invited_by":"Pozvánka od","trust_level":"Důvěryhodnost","notifications":"Oznámení","dynamic_favicon":"Zobrazovat notifikace na favikoně","external_links_in_new_tab":"Otevírat všechny externí odkazy do nové záložky","enable_quoting":"Povolit odpověď s citací z označeného textu","change":"změnit","moderator":"{{user}} je moderátor","admin":"{{user}} je administrátor","suspended_notice":"Uživatel je suspendován do {{date}}.","suspended_reason":"Důvod: ","watched_categories":"Hlídané","watched_categories_instructions":"Nová témata v těchto kategoriích budou hlídaná. Na všechny nové příspěvky budete upozorněni.","tracked_categories":"Sledované","muted_categories":"Ztišené","muted_categories_instructions":"Nebudete upozorněni na žádná nová témata v těchto kategoriích a ani se nebudou zobrazovat jako nepřečtené.","delete_account":"Smazat můj účet","delete_account_confirm":"Jste si jisti, že chcete trvale odstranit svůj účet? Tuto akci nelze vrátit zpět!","deleted_yourself":"Váš účet byl úspěšně odstraněn.","delete_yourself_not_allowed":"Váš účet teď nejde odstranit. Obraťte se na správce aby váš účet smazal za vás.","unread_message_count":"Zprávy","messages":{"all":"Všechny","mine":"Moje","unread":"Nepřečtené"},"change_password":{"success":"(email odeslán)","in_progress":"(odesílám)","error":"(chyba)","action":"Odeslat email na obnovu hesla","set_password":"Nastavit heslo"},"change_about":{"title":"Změna o mně"},"change_username":{"title":"Změnit uživatelské jméno","confirm":"Změna uživatelského jména může mít vážné následky. Opravdu to chcete udělat?","taken":"Toto uživatelské jméno je již zabrané.","error":"Nastala chyba při změně uživatelského jména.","invalid":"Uživatelské jméno je neplatné. Musí obsahovat pouze písmena a číslice."},"change_email":{"title":"Změnit emailovou adresu","taken":"Tato emailová adresa není k dispozici.","error":"Nastala chyba při změně emailové adresy. Není tato adresa již používaná?","success":"Na zadanou adresu jsme zaslali email. Následujte, prosím, instrukce v tomto emailu."},"change_avatar":{"title":"Změna avataru","gravatar":"Založeno na \u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003eu","uploaded_avatar":"Vlastní obrázek","uploaded_avatar_empty":"Přidat vlastní obrázek","upload_title":"Nahrát obrázek","upload_picture":"Nahrát obrázek","image_is_not_a_square":"Upozornění: ořízli jsem váš obrázek; nebyl to čtverec."},"change_profile_background":{"title":"Pozadí profilu"},"email":{"title":"Emailová adresa","ok":"To vypadá dobře. Zašleme vám email s potvrzením.","invalid":"Prosím zadejte platnou emailovou adresu.","authenticated":"Vaše emailová adresa byla autorizována přes službu {{provider}}.","frequency":"Budeme vás informovat emailem pouze pokud jste se na našem webu dlouho neukázali a pokud jste obsah, o kterém vás chceme informovat, doposud neviděli."},"name":{"title":"Jméno","too_short":"Vaše jméno je příliš krátké.","ok":"Vaše jméno vypadá dobře"},"username":{"title":"Uživatelské jméno","short_instructions":"Ostatní vás mohou zmínit pomocí @{{username}}.","available":"Toto uživatelské jméno je volné.","global_match":"Emailová adresa odpovídá registrovaného uživatelskému jménu.","global_mismatch":"již zaregistrováno. Co třeba {{suggestion}}?","not_available":"Není k dispozici. Co třeba {{suggestion}}?","too_short":"Vaše uživatelské jméno je příliš krátké.","too_long":"Vaše uživatelské jméno je příliš dlouhé.","checking":"Zjišťuji, zda je uživatelské jméno volné...","enter_email":"Uživatelské jméno nalezeno. Zadejte odpovídající emailovou adresu.","prefilled":"Emailová adresa odpovídá registrovaného uživatelskému jménu."},"locale":{"title":"Jazyk rozhraní","default":"(výchozí)"},"password_confirmation":{"title":"Heslo znovu"},"last_posted":"Poslední příspěvek","last_emailed":"Email naposledy zaslán","last_seen":"Naposledy viděn","created":"Účet vytvořen","website":"Webová stránka","email_settings":"Emailová upozornění","email_digests":{"title":"When you don't visit the site, send an email digest of what's new:","daily":"denně","weekly":"týdně","bi_weekly":"jednou za 14 dní"},"email_direct":"Upozornění emailem na citace, odpovědi na vaše příspěvky a zmínky @vy","email_private_messages":"Upozornění emailem na novou soukromou zprávu","other_settings":"Ostatní","categories_settings":"Kategorie","new_topic_duration":{"label":"Považovat témata za nová, pokud","not_viewed":"you haven't viewed them yet"},"auto_track_topics":"Automaticky sledovat navštívená témata","auto_track_options":{"never":"nikdy","always":"vždy","after_n_seconds":{"one":"po 1 vteřině","few":"po {{count}} vteřinách","other":"po {{count}} vteřinách"},"after_n_minutes":{"one":"po 1 minutě","few":"po {{count}} minutách","other":"po {{count}} minutách"}},"invited":{"search":"pište pro hledání v pozvánkách...","title":"Pozvánky","user":"Pozvaný uživatel","truncated":"Showing the first {{count}} invites.","redeemed":"Uplatněné pozvánky","redeemed_at":"Uplatněno","pending":"Nevyřízené pozvánky","topics_entered":"Zobrazil témat","posts_read_count":"Přečteno příspěvků","expired":"Poznávka je už prošlá.","rescinded":"Pozvánka odstraněna","time_read":"Čas čtení","days_visited":"Přítomen dnů","account_age_days":"Stáří účtu ve dnech","create":"Poslat pozvánku"},"password":{"title":"Heslo","too_short":"Vaše heslo je příliš krátké.","common":"Toto heslo je používané moc často.","ok":"Vaše heslo je v pořádku.","instructions":"Musí být aspoň %{count} znaků."},"ip_address":{"title":"Poslední IP adresa"},"avatar":{"title":"Avatar"},"title":{"title":"Titul"},"filters":{"all":"Všechno"},"stream":{"posted_by":"Zaslal","sent_by":"Odeslal","private_message":"soukromá zpráva","the_topic":"téma"}},"loading":"Načítám...","close":"Zavřít","read_only_mode":{"enabled":"Správce fóra zapnul režim jen pro čtení. Můžete pokračovat v procházení webu, ale interakce nemusí fungovat správně.","login_disabled":"Přihlášení je zakázáno jelikož fórum je v režimu jen pro čtení."},"learn_more":"více informací...","year":"rok","year_desc":"témata za posledních 365 dní","month":"měsíc","month_desc":"témata za posledních 30 dní","week":"týden","week_desc":"témata za posledních 7 dní","day":"den","first_post":"První příspěvek","mute":"Ignorovat","unmute":"Zrušit ignorování","last_post":"Poslední příspěvek","summary":{"enable":"Přepnout na \"nejlepší příspěvky\"","disable":"Přepnout na normální zobrazení"},"private_message_info":{"title":"Soukromé konverzace","invite":"pozvat účastníka","remove_allowed_user":"Určitě chcete {{name}} dát pryč z téhle soukromé zprávy?"},"email":"Email","username":"Uživatelské jméno","last_seen":"Naposledy viděn","created":"Vytvořeno","trust_level":"Důvěryhodnost","create_account":{"failed":"Něco se nepovedlo, možná je tato e-mailová adresa již použita. Zkuste použít formulář pro obnovení hesla."},"forgot_password":{"title":"Zapomenuté heslo","action":"Zapomněl jsem své heslo","invite":"Vložte svoje uživatelské jméno nebo e-mailovou adresu a my vám zašleme postup pro obnovení hesla.","reset":"Resetovat heslo"},"login":{"username":"Uživatel","password":"Heslo","email_placeholder":"emailová adresa nebo uživatelské jméno","error":"Neznámá chyba","reset_password":"Resetovat heslo","logging_in":"Přihlašuji...","or":"Nebo","authenticating":"Autorizuji...","awaiting_confirmation":"Váš účet nyní čeká na aktivaci, použijte odkaz pro zapomené heslo, jestli chcete, abychom vám zaslali další aktivační email.","awaiting_approval":"Váš účet zatím nebyl schválen moderátorem. Až se tak stane, budeme vás informovat emailem.","requires_invite":"Promiňte, toto fórum je pouze pro zvané.","not_activated":"Ještě se nemůžete přihlásit. Zaslali jsme vám aktivační email v \u003cb\u003e{{sentTo}}\u003c/b\u003e. Prosím následujte instrukce v tomto emailu, abychom mohli váš účet aktivovat.","resend_activation_email":"Klikněte sem pro zaslání aktivačního emailu.","sent_activation_email_again":"Zaslali jsme vám další aktivační email na \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Může trvat několik minut, než vám dorazí. Zkontrolujte také vaši složku s nevyžádanou pošlou.","google":{"title":"přes Google","message":"Autorizuji přes Google (ujistěte se, že nemáte zablokovaná popup okna)"},"google_oauth2":{"title":"přes Google"},"twitter":{"title":"přes Twitter","message":"Autorizuji přes Twitter (ujistěte se, že nemáte zablokovaná popup okna)"},"facebook":{"title":"přes Facebook","message":"Autorizuji přes Facebook (ujistěte se, že nemáte zablokovaná popup okna)"},"yahoo":{"title":"přes Yahoo","message":"Autorizuji přes Yahoo (ujistěte se, že nemáte zablokovaná popup okna)"},"github":{"title":"přes GitHub","message":"Autorizuji přes GitHub (ujistěte se, že nemáte zablokovaná popup okna)"}},"composer":{"posting_not_on_topic":"Rozepsali jste odpověď na téma \"{{title}}\", ale nyní máte otevřené jiné téma.","saving_draft_tip":"ukládám","saved_draft_tip":"uloženo","saved_local_draft_tip":"uloženo lokálně","similar_topics":"Podobná témata","drafts_offline":"koncepty offline","min_length":{"need_more_for_title":"ještě {{n}} znaků nadpisu tématu","need_more_for_reply":"ještě {{n}} znaků textu odpovědi"},"error":{"title_missing":"Název musí být vyplněn","title_too_short":"Název musí být dlouhý alespoň {{min}} znaků","title_too_long":"Název nemůže být delší než {{max}} znaků","post_missing":"Příspěvek nemůže být prázdný","post_length":"Příspěvek musí být alespoň {{min}} znaků dlouhý","category_missing":"Musíte vybrat kategorii"},"save_edit":"Uložit změnu","reply_original":"Odpovědět na původní téma","reply_here":"Odpovědět sem","reply":"Odpovědět","cancel":"Zrušit","create_topic":"Nové téma","create_pm":"Vytvořit soukromou zprávu","title":"Nebo zmáčkněte Ctrl+Enter","users_placeholder":"Přidat uživatele","edit_reason_placeholder":"proč byla nutná úprava?","show_edit_reason":"(přidat důvod úpravy)","reply_placeholder":"Sem napište svou odpověď. Pro formátování použijte Markdown nebo BBCode. Obrázky sem můžete rovnou přetáhnout.","view_new_post":"Zobrazit váš nový příspěvek.","saving":"Ukládám...","saved":"Uloženo!","uploading":"Nahrávám...","show_preview":"zobrazit náhled \u0026raquo;","hide_preview":"\u0026laquo; skrýt náhled","quote_post_title":"Citovat celý příspěvek","bold_title":"Tučně","bold_text":"tučný text","italic_title":"Kurzíva","italic_text":"text kurzívou","link_title":"Odkazy","link_description":"sem vložte popis odkazu","link_dialog_title":"Vložit odkaz","link_optional_text":"volitelný popis","quote_title":"Bloková citace","quote_text":"Bloková citace","code_title":"Ukázka kódu","upload_title":"Obrázek","upload_description":"sem vložek popis obrázku","olist_title":"Číslovaný seznam","ulist_title":"Odrážkový seznam","list_item":"Položka seznam","heading_title":"Nadpis","heading_text":"Nadpis","hr_title":"Horizontální oddělovač","undo_title":"Zpět","redo_title":"Opakovat","help":"Nápověda pro Markdown","toggler":"zobrazit nebo skrýt editor příspěvku","admin_options_title":"Volitelné administrační nastavení tématu","auto_close_label":"Automaticky zavřít téma:","auto_close_units":"(# hodin, čas, nebo datum)","auto_close_examples":"Příklady: 24, 17:00, 2013-11-22 14:00","auto_close_error":"Zadejte prosím platnou hodnotu."},"notifications":{"title":"oznámení o zmínkách pomocí @jméno, odpovědi na vaše příspěvky a témata, soukromé zprávy, atd.","none":"V tuto chvíli nemáte žádná oznámení.","more":"zobrazit starší oznámení","total_flagged":"celkem nahlášeno příspěvků"},"upload_selector":{"title":"Vložit obrázek","title_with_attachments":"Nahrát obrázek nebo soubor","from_my_computer":"Z mého zařízení","from_the_web":"Z webu","remote_tip":"zadejte adresu obrázku ve formátu http://example.com/image.jpg","remote_tip_with_attachments":"zadejte adresu obrázku nebo souboru ve formátu http://example.com/file.ext","local_tip":"klikněte sem pro výběr obrázku z vašeho zařízení.","local_tip_with_attachments":"klikněte sem pro výběr obrázku nebo souboru z vašeho zařízení.","hint":"(můžete také rovnou soubor do editoru přetáhnout)","hint_for_supported_browsers":"(můžete také rovnou obrázky do editoru přetáhnout)","uploading":"Nahrávám","image_link":"adresa na kterou má váš obrázek odkazovat"},"search":{"no_results":"Nenalezeny žádné výsledky.","searching":"Hledám ..."},"site_map":"přejít na jiný seznam témat nebo kategorii","go_back":"jít zpět","not_logged_in_user":"stránka uživatele s přehledem o aktuální činnosti a nastavení","current_user":"jít na vaši uživatelskou stránku","starred":{"title":"Oblíbené","help":{"star":"přidat toto téma do oblíbených","unstar":"odebrat toto téma z oblíbených"}},"topics":{"bulk":{"reset_read":"reset přečteného","dismiss_new":"Odbýt nová","toggle":"hromadný výběr témat","actions":"Hromadné akce","change_category":"Změnit kategorii","close_topics":"Zavřít téma","notification_level":"Změnit úroveň upozornění","selected":{"one":"Vybrali jste \u003cb\u003e1\u003c/b\u003e téma.","few":"Vybrali jste \u003cb\u003e{{count}}\u003c/b\u003e témata.","other":"Vybrali jste \u003cb\u003e{{count}}\u003c/b\u003e témat."}},"none":{"starred":"Zatím nemáte žádná oblíbená témata. Pro přidání tématu do oblíbených, klikněte na hvězdičku vedle názvu tématu.","unread":"Nemáte žádná nepřečtená témata.","new":"Nemáte žádná nová témata ke čtení.","read":"Zatím jste nečetli žádná témata.","posted":"Zatím jste nepřispěli do žádného tématu.","latest":"Nejsou tu žádná témata z poslední doby. To je docela smutné.","hot":"Nejsou tu žádná populární témata.","category":"V kategorii {{category}} nejsou žádná témata.","top":"Nejsou tu žádná populární témata."},"bottom":{"latest":"Nejsou tu žádná další témata z poslední doby.","hot":"Nejsou tu žádná další populární témata k přečtení.","posted":"Nejsou tu žádná další zaslaná témata k přečtení.","read":"Nejsou tu žádná další přečtená témata.","new":"Nejsou tu žádná další nová témata k přečtení.","unread":"Nejsou tu žádná další nepřečtená témata.","starred":"Nejsou tu žádná další oblíbená témata k přečtení.","category":"V kategorii {{category}} nejsou žádná další témata.","top":"Nejsou tu žádná další populární témata."}},"topic":{"filter_to":"{{post_count}} příspěvků v tématu","create":"Nové téma","create_long":"Vytvořit nové téma","private_message":"Vytvořit soukromou konverzaci","list":"Témata","new":"nové téma","new_topics":{"one":"1 nové téma","few":"{{count}} nová témata","other":"{{count}} nových témat"},"unread_topics":{"one":"1 nepřečtené téma","few":"{{count}} nepřečtená témata","other":"{{count}} nepřečtených témat"},"title":"Téma","loading_more":"Nahrávám další témata...","loading":"Nahrávám téma...","invalid_access":{"title":"Téma je soukromé","description":"Bohužel nemáte přístup k tomuto tématu."},"server_error":{"title":"Téma se nepodařilo načíst","description":"Bohužel není možné načíst toto téma, může to být způsobeno problémem s vaším připojením. Prosím, zkuste stránku načíst znovu. Pokud bude problém přetrvávat, dejte nám vědět."},"not_found":{"title":"Téma nenalezeno","description":"Bohužel se nám nepovedlo najít toto téma. Nebylo odstraněno moderátorem?"},"unread_posts":{"one":"máte 1 nepřečtený příspěvěk v tomto tématu","few":"máte {{count}} nepřečtené příspěvky v tomto tématu","other":"máte {{count}} nepřečtených příspěvků v tomto tématu"},"new_posts":{"one":"je zde 1 nový příspěvek od doby, kdy jste toto téma naposledy četli","few":"jsou zde {{count}} nové příspěvky od doby, kdy jste toto téma naposledy četli","other":"je zde {{count}} nových příspěvků od doby, kdy jste toto téma naposledy četli"},"likes":{"one":"v tomto tématu je jedno 'líbí se'","few":"v tomto tématu tématu je {{count}} 'líbí se'","other":"v tomto tématu tématu je {{count}} 'líbí se'"},"back_to_list":"Zpátky na seznam témat","options":"Možnosti","show_links":"zobrazit odkazy v tomto tématu","toggle_information":"zobrazit/skrýt detaily tématu","read_more_in_category":"Chcete si toho přečíst víc? Projděte si témata v {{catLink}} nebo {{latestLink}}.","read_more":"Chcete si přečíst další informace? {{catLink}} nebo {{latestLink}}.","browse_all_categories":"Projděte všechny kategorie","view_latest_topics":"si zobrazte populární témata","suggest_create_topic":"Co takhle založit nové téma?","jump_reply_up":"přejít na předchozí odpověď","jump_reply_down":"přejít na následující odpověď","deleted":"Téma bylo smazáno","auto_close_notice":"Toto téma se automaticky zavře %{timeLeft}.","auto_close_title":"Nastavení automatického zavření","auto_close_save":"Uložit","auto_close_remove":"Nezavírat téma automaticky","progress":{"title":"pozice v tématu","jump_bottom_with_number":"Skočit na příspěvěk %{post_number}","total":"celkem příspěvků","current":"aktuální příspěvek","position":"příspěvek %{current} z %{total}"},"notifications":{"reasons":{"3_6":"Budete dostávat oznámení, protože hlídáte tuhle kategorii.","3_5":"Budete dostávat oznámení, protože jste tohle téma automaticky začali hlídat.","3_2":"Budete dostávat oznámení, protože hlídáte toto téma.","3_1":"Budete dostávat oznámení, protože jste autorem totoho tématu.","3":"Budete dostávat oznámení, protože hlídáte toto téma.","2_8":"Budete dostávat upozornění, protože sledujete tuto kategorii.","2_4":"Budete dostávat oznámení, protože jste zaslal odpověď do tohoto tématu.","2_2":"Budete dostávat oznámení, protože sledujete toto téma.","2":"Budete dostávat oznámení, protože \u003ca href=\"/users/{{username}}/preferences\"\u003ejste četli toto téma\u003c/a\u003e.","1_2":"Dostanete oznámení, jestliže vás někdo zmíní pomocí @name nebo odpoví na váš příspěvek.","1":"Dostanete oznámení, jestliže vás někdo zmíní pomocí @name nebo odpoví na váš příspěvek.","0_7":"Ignorujete všechna oznámení v této kategorii.","0_2":"Ignorujete všechna oznámení z tohoto tématu.","0":"Ignorujete všechna oznámení z tohoto tématu."},"watching_pm":{"title":"Hlídání"},"watching":{"title":"Hlídané"},"tracking_pm":{"title":"Sledování"},"tracking":{"title":"Sledované"},"regular":{"title":"Klasicky","description":"Dostanete oznámení na nové odpovědi k vašim příspěvkům a na zmínky přes @jméno."},"muted_pm":{"title":"Ztišení","description":"Nikdy nedostanete oznámení týkající se čehokoliv o této soukromé zprávě."},"muted":{"title":"Ztišené","description":"nebudete dostávat žádná oznámení k tomuto tématu a ani se nebude zobrazovat v seznamu nepřečtených témat."}},"actions":{"recover":"Vrátit téma","delete":"Odstranit téma","open":"Otevřít téma","close":"Zavřít téma","auto_close":"Automaticky zavřít","unpin":"Odstranit připnutí","pin":"Připnout téma","pin_globally":"Připnout téma globálně","unarchive":"Navrátit z archivu","archive":"Archivovat téma","invisible":"Zneviditelnit téma","visible":"Zviditelnit","reset_read":"Vynulovat počet čtení","multi_select":"Výběr více příspěvků"},"reply":{"title":"Odpovědět","help":"začněte psát odpověď na toto téma"},"clear_pin":{"title":"Odstranit připnutí","help":"Odebere připnutí tohoto tématu, takže se již nebude zobrazovat na vrcholu seznamu témat"},"share":{"title":"Sdílet","help":"sdílet odkaz na toto téma"},"flag_topic":{"title":"Nahlásit","help":"Soukromě nahlásit tento příspěvek moderátorům","success_message":"Téma úspěšně nahlášeno."},"inviting":"Odesílám pozvánku...","invite_private":{"title":"Pozvat do soukromé konverzace","email_or_username":"Email nebo uživatelské jméno pozvaného","email_or_username_placeholder":"emailová adresa nebo uživatelské jméno","action":"Pozvat","error":"Bohužel nastala chyba při odesílání pozvánky.","group_name":"název skupiny"},"invite_reply":{"title":"Pozvat k diskuzi","action":"Odeslat pozvánku","help":"odeslat pozvánku přátelům, aby mohli na toto téma odpovědět jedním kliknutím","email_placeholder":"name@example.com","error":"Bohužel se nepodařilo pozvat tuto osobu. Není již registrovaným uživatelem?"},"filters":{"n_posts":{"one":"Je zobrazen pouze 1 příspěvek","few":"Jsou zobrazeny pouze {{count}} příspěvky","other":"Je zobrazeno pouze {{count}} příspěvků"},"cancel":"Zobrazí znovu všechny příspěvky v tomto tématu."},"split_topic":{"title":"Rozdělit téma","action":"do nového téma","topic_name":"Název nového tématu:","error":"Bohužel nastala chyba při rozdělování tématu.","instructions":{"one":"Chystáte se vytvořit nové téma a naplnit ho příspěvkem, který jste označili.","few":"Chystate se vytvořit noté téma a naplnit ho \u003cb\u003e{{count}}\u003c/b\u003e příspěvky, které jste označili.","other":"Chystate se vytvořit noté téma a naplnit ho \u003cb\u003e{{count}}\u003c/b\u003e příspěvky, které jste označili."}},"merge_topic":{"title":"Sloučit téma","action":"do jiného tématu","error":"Bohužel nastala chyba při slučování tématu.","instructions":{"one":"Prosím, vyberte téma, do kterého chcete příspěvek přesunout.","few":"Prosím, vyberte téma, do kterého chcete tyto \u003cb\u003e{{count}}\u003c/b\u003e příspěvky přesunout.","other":"Prosím, vyberte téma, do kterého chcete těchto \u003cb\u003e{{count}}\u003c/b\u003e příspěvků přesunout."}},"change_owner":{"title":"Změnit autora","action":"změna autora","error":"Chyba při měnění autora u příspevků.","label":"Nový autor příspěvků","placeholder":"uživatelské jméno nového autora","instructions":{"one":"Vyberte prosím nového autora příspěvku od \u003cb\u003e{{old_user}}\u003c/b\u003e.","few":"Vyberte prosím nového autora {{count}} příspěvků od \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Vyberte prosím nového autora {{count}} příspěvků od \u003cb\u003e{{old_user}}\u003c/b\u003e."}},"multi_select":{"select":"vybrat","selected":"vybráno ({{count}})","select_replies":"vybrat +odpovědi","delete":"smazat označené","cancel":"zrušit označování","select_all":"vybrat vše","deselect_all":"zrušit výběr","description":{"one":"Máte označen \u003cb\u003e1\u003c/b\u003e příspěvek.","few":"Máte označeny \u003cb\u003e{{count}}\u003c/b\u003e příspěvky.","other":"Máte označeno \u003cb\u003e{{count}}\u003c/b\u003e příspěvků."}}},"post":{"reply":"Odpovídáte na {{link}} od {{replyAvatar}} {{username}}","reply_topic":"Odpověď na {{link}}","quote_reply":"odpověď s citací","edit":"Editujete {{link}} od uživatele {{replyAvatar}} {{username}}","edit_reason":"Důvod: ","post_number":"příspěvek č. {{number}}","in_reply_to":"Odpovědět","last_edited_on":"příspěvek naposledy upraven","reply_as_new_topic":"Odpovědět přes nové téma","continue_discussion":"Pokračující diskuze z {{postLink}}:","follow_quote":"přejít na citovaný příspěvek","show_full":"Zobrazit celý příspěvek","deleted_by_author":{"one":"(post withdrawn by author, will be automatically deleted in %{count} hour unless flagged)","few":"(post withdrawn by author, will be automatically deleted in %{count} hours unless flagged)","other":"(post withdrawn by author, will be automatically deleted in %{count} hours unless flagged)"},"expand_collapse":"rozbalit/sbalit","gap":{"one":"1 příspěvek schován","few":"{{count}} příspěvky schovány","other":"{{count}} příspěvků schováno"},"more_links":"{{count}} dalších...","unread":"Příspěvek je nepřečtený.","has_replies":{"one":"Odpovědět","few":"Odpovědi","other":"Odpovědi"},"errors":{"create":"Bohužel nastala chyba při vytváření příspěvku. Prosím zkuste to znovu.","edit":"Bohužel nastala chyba při editaci příspěvku. Prosím zkuste to znovu.","upload":"Bohužel nastala chyba při nahrávání příspěvku. Prosím zkuste to znovu.","attachment_too_large":"Soubor, který se snažíte nahrát je bohužel příliš velký (maximální velikost je {{max_size_kb}}kb). Prosím zmenšete ho zkuste to znovu.","image_too_large":"Obrázek, který se snažíte nahrát je bohužel příliš velký (maximální velikost je {{max_size_kb}}kb). Prosím zmenšete ho zkuste to znovu.","too_many_uploads":"Bohužel, najednou smíte nahrát jen jeden soubor.","upload_not_authorized":"Bohužel, soubor, který se snažíte nahrát, není povolený (povolené přípony: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Bohužel, noví uživatelé nemohou nahrávat obrázky.","attachment_upload_not_allowed_for_new_user":"Bohužel, noví uživatelé nemohou nahrávat přílohy."},"abandon":{"confirm":"Opravdu chcete svůj příspěvek zahodit?","no_value":"Nezahazovat","yes_value":"Ano, zahodit"},"archetypes":{"save":"Uložit nastavení"},"controls":{"reply":"otevře okno pro sepsání odpovědi na tento příspěvek","like":"to se mi líbí","edit":"upravit příspěvek","flag":"nahlásit příspěvek moderátorovi","delete":"smazat příspěvek","undelete":"obnovit příspěvek","share":"sdílet odkaz na tento příspěvek","more":"Více","delete_replies":{"confirm":{"one":"Do you also want to delete the direct reply to this post?","few":"Do you also want to delete the {{count}} direct replies to this post?","other":"Do you also want to delete the {{count}} direct replies to this post?"},"yes_value":"Ano, smazat i odpovědi","no_value":"Ne, jenom tento příspěvek"}},"actions":{"flag":"Nahlásit","it_too":{"off_topic":"Také nahlásit","spam":"Také nahlásit","inappropriate":"Také nahlásit","custom_flag":"Také nahlásit","bookmark":"Také přidat do záložek","like":"To se mi také líbí","vote":"Hlasovat také"},"undo":{"off_topic":"Zrušit nahlášení","spam":"Zrušit nahlášení","inappropriate":"Zrušit nahlášení","bookmark":"Odebrat ze záložek","like":"Už se mi to nelíbí","vote":"Zrušit hlas"},"people":{"notify_moderators":"{{icons}} nahlásili tento příspěvek","notify_moderators_with_url":"{{icons}} \u003ca href='{{postUrl}}'\u003enahlásili tento příspěvek\u003c/a\u003e","notify_user":"{{icons}} zahájili soukromou konverzaci","notify_user_with_url":"{{icons}} zahájijli a \u003ca href='{{postUrl}}'\u003esoukromou konverzaci\u003c/a\u003e","bookmark":"{{icons}} si přidali příspěvek do záložek","like":"{{icons}} se líbí tento příspěvek","vote":"{{icons}} hlasovali pro tento příspěvek"},"by_you":{"off_topic":"Označili jste tento příspěvek jako off-topic","spam":"Označili jste tento příspěvek jako spam","inappropriate":"Označili jste tento příspěvek jako nevhodný","notify_moderators":"Nahlásili jste tento příspěvek","notify_user":"Zahájili jste soukromou konverzaci s tímto uživatelem","bookmark":"Přidali jste si tento příspěvek do záložek","like":"Toto se vám líbí","vote":"Hlasovali jste pro tento příspěvek"},"by_you_and_others":{"off_topic":{"one":"Vy a 1 další člověk jste označili tento příspěvek jako off-topic","few":"Vy a {{count}} další lidé jste označili tento příspěvek jako off-topic","other":"Vy a {{count}} dalších lidí jste označili tento příspěvek jako off-topic"},"spam":{"one":"Vy a 1 další člověk jste označili tento příspěvek jako spam","few":"Vy a {{count}} další lidé jste označili tento příspěvek jako spam","other":"Vy a {{count}} dalších lidí jste označili tento příspěvek jako spam"},"inappropriate":{"one":"Vy a 1 další člověk jste označili tento příspěvek jako nevhodný","few":"Vy a {{count}} další lidé jste označili tento příspěvek jako nevhodný","other":"Vy a {{count}} dalších lidí jste označili tento příspěvek jako nevhodný"},"notify_moderators":{"one":"Vy a 1 další člověk jste nahlásili tento příspěvek","few":"Vy a {{count}} další lidé jste nahlásili tento příspěvek","other":"Vy a {{count}} dalších lidí jste nahlásili tento příspěvek"},"notify_user":{"one":"Vy a 1 další člověk jste zahájili soukromou konverzaci s tímto uživatelem","few":"Vy a {{count}} další lidé jste zahájili soukromou konverzaci s tímto uživatelem","other":"Vy a {{count}} dalších lidí jste zahájili soukromou konverzaci s tímto uživatelem"},"bookmark":{"one":"Vy a 1 další člověk jste si přidali tento příspěvek do záložek","few":"Vy a {{count}} další lidé jste si přidali tento příspěvek do záložek","other":"Vy a {{count}} dalších lidí si přidali tento příspěvek do záložek"},"like":{"one":"Vám a 1 dalšímu člověku se tento příspěvek líbí","few":"Vám a {{count}} dalším lidem se tento příspěvek líbí","other":"Vám a {{count}} dalším lidem se tento příspěvek líbí"},"vote":{"one":"Vy a 1 další člověk jste hlasovali pro tento příspěvek","few":"Vy a {{count}} další lidé jste hlasovali pro tento příspěvek","other":"Vy a {{count}} dalších lidí jste hlasovali pro tento příspěvek"}},"by_others":{"off_topic":{"one":"1 člověk označil tento příspěvek jako off-topic","few":"{{count}} lidé označili tento příspěvek jako off-topic","other":"{{count}} lidí označilo tento příspěvek jako off-topic"},"spam":{"one":"1 člověk označil tento příspěvek jako spam","few":"{{count}} lidé označili tento příspěvek jako spam","other":"{{count}} lidí označilo tento příspěvek jako spam"},"inappropriate":{"one":"1 člověk označil tento příspěvek jako nevhodný","few":"{{count}} lidé označili tento příspěvek jako nevhodný","other":"{{count}} lidí označilo tento příspěvek jako nevhodný"},"notify_moderators":{"one":"1 člověk nahlásil tento příspěvek","few":"{{count}} lidé nahlásili tento příspěvek","other":"{{count}} lidí nahlásilo tento příspěvek"},"notify_user":{"one":"1 člověk zahájil soukromou konverzaci s tímto uživatelem","few":"{{count}} lidé zahájili soukromou konverzaci s tímto uživatelem","other":"{{count}} lidí zahájilo soukromou konverzaci s tímto uživatelem"},"bookmark":{"one":"1 člověk si přidal tento příspěvek do záložek","few":"{{count}} lidé si přidali tento příspěvek do záložek","other":"{{count}} lidí si přidalo tento příspěvek do záložek"},"like":{"one":"1 člověku se tento příspěvek líbí","few":"{{count}} lidem se tento příspěvek líbí","other":"{{count}} lidem se tento příspěvek líbí"},"vote":{"one":"1 člověk hlasoval pro tento příspěvek","few":"{{count}} lidé hlasovali pro tento příspěvek","other":"{{count}} lidí hlasovalo pro tento příspěvek"}}},"edits":{"one":"1 úprava","other":"{{count}} úprav","zero":"žádné úpravy"},"delete":{"confirm":{"one":"Opravdu chcete odstranit tento příspěvek?","few":"Opravdu chcete odstranit všechny tyto příspěvky?","other":"Opravdu chcete odstranit všechny tyto příspěvky?"}},"revisions":{"controls":{"first":"První revize","previous":"Předchozí revize","next":"Další revize","last":"Poslední revize","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e vs \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Vykreslený příspěvek se změnami zobrazenými v textu","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Rozdíli mezi vykreslenými příspěveky vedle sebe","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Příspěvky v markdownu vedle sebe","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Markdown"}},"details":{"edited_by":"Upravil"}}},"category":{"can":"smí\u0026hellip; ","none":"(bez kategorie)","choose":"Vyberte kategorii\u0026hellip;","edit":"upravit","edit_long":"Upravit","view":"Zobrazit témata v kategorii","general":"Základní","settings":"Nastavení","delete":"Smazat kategorii","create":"Vytvořit kategorii","save":"Uložit kategorii","creation_error":"Během vytváření nové kategorie nastala chyba.","save_error":"Během ukládání kategorie nastala chyba.","name":"Název kategorie","description":"Popis","topic":"téma kategorie","badge_colors":"Barvy štítku","background_color":"Barva pozadí","foreground_color":"Barva textu","name_placeholder":"Měl by být krátký a výstižný.","color_placeholder":"Jakákoliv webová barva","delete_confirm":"Opravdu chcete odstranit tuto kategorii?","delete_error":"Nastala chyba při odstraňování kategorie.","list":"Seznam kategorií","no_description":"Doplňte prosím popis této kategorie.","change_in_category_topic":"navštivte téma kategorie pro editaci jejího popisu","already_used":"Tato barva je již použita jinou kategorií","security":"Zabezpečení","auto_close_label":"Automaticky zavírat témata po:","auto_close_units":"hodinách","email_in":"Vlastní příchozí emailová adresa:","edit_permissions":"Upravit oprávnění","add_permission":"Přidat oprávnění","this_year":"letos","position":"umístění","default_position":"Výchozí umístění","parent":"Nadřazená kategorie","notifications":{"watching":{"title":"Hlídání"},"tracking":{"title":"Sledování"},"regular":{"title":"Normální"},"muted":{"title":"Ztišený"}}},"flagging":{"title":"Proč nahlašujete tento příspěvek?","action":"Nahlásit příspěvek","take_action":"Zakročit","notify_action":"Private message","delete_spammer":"Odstranit spamera","delete_confirm":"Chystáte se odstranit \u003cb\u003e%{posts}\u003c/b\u003e příspěvků a \u003cb\u003e%{topics}\u003c/b\u003e témat od tohoto uživatele, smazat jeho účet, a vložit jeho emailovou adresu \u003cb\u003e%{email}\u003c/b\u003e na seznam permanentně blokovaných. Jste si jistí, že je tento uživatel opravdu spamer?","yes_delete_spammer":"Ano, odstranit spamera","cant":"Bohužel nyní nemůžete tento příspěvek nahlásit.","custom_placeholder_notify_user":"Proč chcete s tímto uživatele mluvit přímo a soukromě? Buďte konstruktivní, konkrétní a hlavně vstřícní.","custom_placeholder_notify_moderators":"Proč příspěvek vyžaduje pozornost moderátora? Dejte nám vědět, co konkrétně vás znepokojuje, a poskytněte relevantní odkazy, je-li to možné.","custom_message":{"at_least":"zadejte alespoň {{n}} znaků","more":"ještě {{n}}...","left":"{{n}} zbývá"}},"flagging_topic":{"title":"Proč nahlašujete tento příspěvek?","action":"Nahlásit téma","notify_action":"Private message"},"topic_map":{"title":"Souhrn tématu","links_shown":"zobrazit všech {{totalLinks}} odkazů...","clicks":{"one":"1 kliknutí","few":"%{count} kliknutí","other":"%{count} kliknutí"}},"topic_statuses":{"locked":{"help":"toto téma je uzavřené; další odpovědi nejsou přijímány"},"unpinned":{"title":"Nepřipnuté","help":"Toto téme není připnuté; bude se zobrazovat v běžném pořadí"},"pinned_globally":{"title":"Připnuté globálně","help":"Toto téma je připnuto globálně, zobrazí se na vršku všech seznamů"},"pinned":{"title":"Připnuto","help":"toto téma je připnuté; bude se zobrazovat na vrcholu seznamu ve své kategorii"},"archived":{"help":"toto téma je archivováno; je zmraženo a nelze ho již měnit"},"invisible":{"help":"toto téma je neviditelné; nebude se zobrazovat v seznamu témat a lze ho navštívit pouze přes přímý odkaz"}},"posts":"Příspěvků","posts_long":"v tomto tématu je {{number}} příspěvků","original_post":"Původní příspěvek","views":"Zobrazení","replies":"Odpovědi","views_long":"toto téma bylo zobrazeno {{number}}krát","activity":"Aktivita","likes":"Líbí se","likes_long":"v tomto tématu je {{number}} 'líbí se'","users":"Účastníci","category_title":"Kategorie","history":"Historie","changed_by":"od uživatele {{author}}","categories_list":"Seznam kategorií","filters":{"latest":{"title":"Nejnovější","help":"nejaktuálnější témata"},"hot":{"title":"Populární","help":"populární témata z poslední doby"},"starred":{"title":"Oblíbená","help":"témata, která jste označili jako oblíbená"},"read":{"title":"Přečtená","help":"témata, která jste si přečetli"},"categories":{"title":"Kategorie","title_in":"Kategorie - {{categoryName}}","help":"všechna témata seskupená podle kategorie"},"unread":{"title":{"zero":"Nepřečtená","one":"Nepřečtená (1)","other":"Nepřečtená ({{count}})"}},"new":{"lower_title_with_count":{"one":"1 nový","other":"{{count}} nové"},"lower_title":"nové","title":{"zero":"Nová","one":"Nová (1)","other":"Nová ({{count}})"}},"posted":{"title":"Mé příspěvky","help":"témata, do kterých jste přispěli"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"populární témata v kategorii {{categoryName}}"},"top":{"title":"Nejlepší","yearly":{"title":"Nejlepší podle let"},"monthly":{"title":"Nejlepší podle měsíce"},"weekly":{"title":"Nejlepší podle týdne"},"daily":{"title":"Nejlepší podle dní"},"this_year":"Letos","this_month":"Tenhle měsíc","this_week":"Tenhle týden","today":"Dnes","other_periods":"další nejlepší témata"}},"permission_types":{"full":"Vytvářet / Odpovídat / Prohlížet","create_post":"Odpovídat / Prohlížet","readonly":"Prohlížet"},"type_to_filter":"text pro filtrování...","admin":{"title":"Administrátor","moderator":"Moderátor","dashboard":{"title":"Rozcestník","last_updated":"Přehled naposled aktualizován:","version":"Verze Discourse","up_to_date":"Máte aktuální!","critical_available":"Je k dispozici důležitá aktualizace.","updates_available":"Jsou k dispozici aktualizace.","please_upgrade":"Prosím aktualizujte!","no_check_performed":"Kontrola na aktualizace nebyla provedena. Ujistěte se, že běží služby sidekiq.","stale_data":"V poslední době neproběhal kontrola aktualizací. Ujistěte se, že běží služby sidekiq.","version_check_pending":"Že tys nedávno provedl aktualizaci. Báječné!","installed_version":"Nainstalováno","latest_version":"Poslední verze","problems_found":"Byly nalezeny problémy s vaší instalací systému Discourse:","last_checked":"Naposledy zkontrolováno","refresh_problems":"Obnovit","no_problems":"Nenalezeny žádné problémy.","moderators":"Moderátoři:","admins":"Administrátoři:","blocked":"Blokováno:","suspended":"Zakázáno:","private_messages_short":"Soukromé zprávy","private_messages_title":"Soukromé zprávy","reports":{"today":"Dnes","yesterday":"Včera","last_7_days":"Týden","last_30_days":"Měsíc","all_time":"Za celou dobu","7_days_ago":"Týden","30_days_ago":"Měsíc","all":"Celkem","view_table":"Zobrazit jako tabulku","view_chart":"Zobrazit jako sloupcový graf"}},"commits":{"latest_changes":"Poslední změny:","by":"od"},"flags":{"title":"Nahlášení","old":"Staré","active":"Aktivní","clear_topic_flags":"Hotovo","clear_topic_flags_title":"The topic has been investigated and issues have been resolved. Click Done to remove the flags.","flagged_by":"Nahlásil","system":"Systémové soukromé zprávy","error":"Něco se pokazilo","no_results":"Nejsou zde žádná nahlášení.","topic_flagged":"Tohle \u003cstrong\u003etéma\u003c/strong\u003e bylo označeno.","summary":{"action_type_3":{"one":"off-topic","few":"off-topic x{{count}}","other":"off-topic x{{count}}"},"action_type_4":{"one":"nevhodné","few":"nevhodné x{{count}}","other":"nevhodné x{{count}}"},"action_type_6":{"one":"spam","few":"spam x{{count}}","other":"spam x{{count}}"},"action_type_7":{"one":"vlastní","few":"vlastní x{{count}}","other":"vlastní x{{count}}"},"action_type_8":{"one":"spam","few":"spam x{{count}}","other":"spam x{{count}}"}}},"groups":{"primary":"Hlavní skupina","no_primary":"(žádná hlavní skupina)","title":"Skupiny","edit":"Upravit skupiny","refresh":"Obnovit","new":"Nová","selector_placeholder":"přidat uživatele","name_placeholder":"Název skupiny, bez mezer, stejná pravidla jako pro uživatelská jména","about":"Zde můžete upravit názvy skupin a členství","group_members":"Členové skupiny","delete":"Smazat","delete_confirm":"Smazat toto skupiny?","delete_failed":"Unable to delete group. If this is an automatic group, it cannot be destroyed."},"api":{"generate_master":"Vygenerovat Master API Key","none":"Nejsou tu žádné aktivní API klíče.","user":"Uživatel","title":"API","key":"API klíč","generate":"Vygenerovat API klíč","regenerate":"Znovu-vygenerovat API klíč","revoke":"zrušit","confirm_regen":"Určitě chcete nahradit tenhle API klíč novým?","confirm_revoke":"Jste si jisti, že chcete tento klíč zrušit?","info_html":"Váš API klíč umožní vytvářet a aktualizovat témata pomocí JSONových volání.","all_users":"Všichni uživatelé"},"backups":{"title":"Zálohy","menu":{"backups":"Zálohy","logs":"Logy"},"none":"Žádné zálohy nejsou k dispozici.","read_only":{"enable":{"title":"Zapnout režim jen pro čtení","text":"Zapnout režim jen pro čtení","confirm":"Určitě chcete zapnout režim jen pro čtení?"},"disable":{"title":"Vypnout režim jen pro čtení","text":"Disable read-only mode"}},"logs":{"none":"Zatím je log prázdný..."},"columns":{"filename":"Název souboru","size":"Velikost"},"upload":{"text":"NAHRÁT","uploading":"UPLOADING","success":"'{{filename}}' has successfully been uploaded.","error":"There has been an error while uploading '{{filename}}': {{message}}"},"operations":{"is_running":"An operation is currently running...","failed":"The {{operation}} failed. Please check the logs.","cancel":{"text":"Zrušit","title":"Cancel the current operation","confirm":"Are you sure you want to cancel the current operation?"},"backup":{"text":"Zálohovat","title":"Vytvořit zálohu"},"download":{"text":"Stáhnout","title":"Stáhnout zálohu"},"destroy":{"text":"Smazat","title":"Odstranit zálohu","confirm":"Are you sure you want to destroy this backup?"},"restore":{"is_disabled":"Restore is disabled in the site settings.","text":"Obnovit","title":"Restore the backup","confirm":"Are your sure you want to restore this backup?"},"rollback":{"text":"Rollback","title":"Rollback the database to previous working state","confirm":"Are your sure you want to rollback the database to the previous working state?"}}},"customize":{"title":"Přizpůsobení","long_title":"Přizpůsobení webu","header":"header","css":"CSS","mobile_header":"Mobilní header","mobile_css":"Mobilní CSS","override_default":"Přetížit výchozí?","enabled":"Zapnuto?","preview":"náhled","save":"Uložit","new":"Nové","new_style":"Nový styl","delete":"Smazat","delete_confirm":"Smazat toto přizpůsobení?","color":"Barva","opacity":"Neprůhlednost","copy":"Kopírovat","css_html":{"long_title":"Přizpůsobení CSS a HTML"},"colors":{"title":"Barvy","long_title":"Barevná schémata","new_name":"Nové barevné schéma","copy_name_prefix":"Kopie"}},"email":{"title":"Email","settings":"Nastavení","all":"Všechny emaily","sending_test":"Zkušební email se odesílá...","sent":"Odeslané","skipped":"Přeskočené","sent_at":"Odesláno","time":"Čas","user":"Uživatel","email_type":"Typ emailu","to_address":"Komu","test_email_address":"testovací emailová adresa","sent_test":"odesláno!","delivery_method":"Způsob doručení","preview_digest":"Náhled souhrnu","preview_digest_desc":"Toto je nástroj pro zobrazení toho, jak bude vypadat pravidelný souhrn odesílaný uživatelům.","refresh":"Aktualizovat","format":"Formát","html":"html","text":"text","last_seen_user":"Uživatel byl naposled přítomen:","reply_key":"Klíč pro odpověď","skipped_reason":"Důvod přeskočení","logs":{"none":"Žádné záznamy nalezeny.","filters":{"title":"Filtr","user_placeholder":"uživatelské jméno","type_placeholder":"souhrn, registrace...","skipped_reason_placeholder":"důvod"}}},"logs":{"title":"Logy a filtry","action":"Akce","created_at":"Zaznamenáno","last_match_at":"Poslední zázn.","match_count":"Záznamů","ip_address":"IP","delete":"Smazat","edit":"Upravit","save":"Uložit","screened_actions":{"block":"blokovat","do_nothing":"nedělat nic"},"staff_actions":{"title":"Akce moderátorů","instructions":"Filtrujte klikem na uživatelská jména a akce. Klikem na avatar přejdete na profil uživatele.","clear_filters":"Zobrazit vše","staff_user":"Moderátor","target_user":"Cílový uživatel","subject":"Předmět","when":"Kdy","context":"Kontext","details":"Podrobnosti","previous_value":"Předchozí","new_value":"Nové","diff":"Rozdíly","show":"Zobrazit","modal_title":"Podrobnosti","no_previous":"Předchozí hodnota neexistuje.","deleted":"Žádná nová hodnota. Záznam byl odstraněn.","actions":{"delete_user":"odstranit uživatele","change_trust_level":"z. důvěryhodnosti","change_site_setting":"změna nastavení","change_site_customization":"změna přizpůsobení","delete_site_customization":"odstranit přizpůsobení","suspend_user":"suspendovat uživatele","unsuspend_user":"zrušit suspendování","grant_badge":"udělit odznak","revoke_badge":"vzít odznak"}},"screened_emails":{"title":"Filtrované emaily","description":"When someone tries to create a new account, the following email addresses will be checked and the registration will be blocked, or some other action performed.","email":"Email Address","actions":{"allow":"Povolit"}},"screened_urls":{"title":"Filtrované URL","description":"URL adresy v tomto seznamu byli použity v příspěvcích od spammerů.","url":"URL","domain":"Doména"},"screened_ips":{"title":"Filtrované IP","description":"Sledované IP adresy. Zvolte „Povolit“ pro přidání IP adresy do whitelistu.","delete_confirm":"Are you sure you want to remove the rule for %{ip_address}?","actions":{"block":"Zablokovat","do_nothing":"Povolit"},"form":{"label":"Nové:","ip_address":"IP adresa","add":"Přidat"}}},"users":{"title":"Uživatelé","create":"Přidat administrátora","last_emailed":"Email naposledy zaslán","not_found":"Bohužel uživatel s tímto jménem není v našem systému.","active":"Aktivní","nav":{"new":"Noví","active":"Aktivní","pending":"Čeká na schválení","admins":"Administrátoři","moderators":"Moderátoři","suspended":"Zakázaní","blocked":"Blokovaní"},"approved":"Schválen?","approved_selected":{"one":"schválit uživatele","few":"schválit uživatele ({{count}})","other":"schválit uživatele ({{count}})"},"reject_selected":{"one":"reject user","few":"reject users ({{count}})","other":"reject users ({{count}})"},"titles":{"active":"Aktivní uživatelé","new":"Noví uživatelé","pending":"Uživatelé čekající na schválení","newuser":"Uživatelé s věrohodností 0 (Nový uživatel)","basic":"Uživatelé s věrohodností 1 (Základní uživatel)","regular":"Uživatelé s věrohodností 2 (Pravidelný uživatel)","elder":"Uživatelé s věrohodností 4 (Starší)","admins":"Admininstrátoři","moderators":"Moderátoři","blocked":"Blokovaní uživatelé","suspended":"Zakázaní uživatelé"},"reject_successful":{"one":"Successfully rejected 1 user.","few":"Successfully rejected %{count} users.","other":"Successfully rejected %{count} users."},"reject_failures":{"one":"Failed to reject 1 user.","few":"Failed to reject %{count} users.","other":"Failed to reject %{count} users."}},"user":{"suspend_failed":"Nastala chyba při zakazování uživatele {{error}}","unsuspend_failed":"Nastala chyba při povolování uživatele {{error}}","suspend_duration":"Jak dlouho má zákaz platit? (dny)","suspend_duration_units":"(days)","suspend_reason_label":"Why are you suspending? This text \u003cb\u003ewill be visible to everyone\u003c/b\u003e on this user's profile page, and will be shown to the user when they try to log in. Keep it short.","suspend_reason":"Reason","suspended_by":"Suspended by","delete_all_posts":"Smazat všechny příspěvky","delete_all_posts_confirm":"You are about to delete %{posts} posts and %{topics} topics. Are you sure?","suspend":"Zakázat","unsuspend":"Povolit","suspended":"Zakázán?","moderator":"Moderátor?","admin":"Administrátor?","blocked":"Zablokovaný?","show_admin_profile":"Administrace","edit_title":"Upravit titul","save_title":"Uložit nadpis","refresh_browsers":"Vynutit obnovení prohlížeče","show_public_profile":"Zobrazit veřejný profil","impersonate":"Vydávat se za uživatele","logged_out":"Uživatel byl odhlášen na všech zařízeních.","revoke_admin":"Odebrat administrátorská práva","grant_admin":"Udělit administrátorská práva","revoke_moderation":"Odebrat moderátorská práva","grant_moderation":"Udělit moderátorská práva","unblock":"Odblokovat","block":"Zablokovat","reputation":"Reputace","permissions":"Oprávnění","activity":"Aktivita","private_topics_count":"Počet soukromách témat","posts_read_count":"Přečteno příspěvků","post_count":"Vytvořeno příspěvků","topics_entered":"Témat zobrazeno","flags_given_count":"Uděleno nahlášení","flags_received_count":"Přijato nahlášení","approve":"Schválit","approved_by":"schválil","approve_success":"Uživatel bys schválen a byl mu zaslán aktivační email s instrukcemi.","approve_bulk_success":"Povedlo se! Všichni uživatelé byli schváleni a byly jim rozeslány notifikace.","time_read":"Čas strávený čtením","delete":"Smazat uživatele","delete_forbidden_because_staff":"Správci ani moderátoři nemůžou být odstraněni.","delete_forbidden":{"one":"Uživatelé nemůžou být smazáni pokud mají příspěvky. Před smazáním uživatele smažte všechny jeho příspěvky. (Příspěvky starší než den nemůžou být smazány.)","few":"Uživatelé nemůžou být smazáni pokud mají příspěvky. Před smazáním uživatele smažte všechny jeho příspěvky. (Příspěvky starší než %{count} dny nemůžou být smazány.)","other":"Uživatelé nemůžou být smazáni pokud mají příspěvky. Před smazáním uživatele smažte všechny jeho příspěvky. (Příspěvky starší než %{count} dnů nemůžou být smazány.)"},"deleted":"Uživatel byl smazán.","delete_failed":"Nastala chyba při odstraňování uživatele. Ujistěte se, že jsou všechny příspěvky tohoto uživatele smazané, než budete uživatele mazat.","send_activation_email":"Odeslat aktivační email","activation_email_sent":"Aktivační email byl odeslán.","send_activation_email_failed":"Nastal problém při odesílání aktivačního emailu.","activate":"Aktivovat účet","activate_failed":"Nasstal problém při aktivování tohoto uživatele.","deactivate_account":"Deaktivovat účet","deactivate_failed":"Nastal problém při deaktivování tohoto uživatele.","unblock_failed":"Nastal problém při odblokování uživatele.","block_failed":"Nastal problém při blokování uživatele.","deactivate_explanation":"Uživatel bude muset znovu potvrdit emailovou adresu.","suspended_explanation":"Zakázaný uživatel se nemůže přihlásit.","block_explanation":"Zablokovaný uživatel nemůže přispívat nebo vytvářet nová témata.","trust_level_change_failed":"Nastal problém při změně důveryhodnosti uživatele.","suspend_modal_title":"Suspend User","trust_level_2_users":"Uživatelé důvěryhodnosti 2","trust_level_3_requirements":"Požadavky pro důvěryhodnost 3","tl3_requirements":{"title":"Požadavky pro důvěryhodnost 3","table_title":"Za posledních 100 dní:","value_heading":"Hodnota","requirement_heading":"Požadavek","visits":"Návštěv","days":"dní","topics_replied_to":"Odpovědí na témata","flagged_posts":"Nahlášené příspěvky"}},"site_content":{"none":"Zvolte typ obsahu a můžete začít editovat.","title":"Obsah webu","edit":"Editovat obsah webu"},"site_settings":{"show_overriden":"Zobrazit pouze změněná nastavení","title":"Nastavení","reset":"obnovit výchozí","none":"žádné","no_results":"Nenalezeny žádné výsledky.","clear_filter":"Zrušit","categories":{"all_results":"Všechny","required":"Nezbytnosti","basic":"Základní nastavení","users":"Uživatelé","posting":"Přispívání","email":"Emaily","files":"Soubory","trust":"Důvěryhodnosti","security":"Bezpečnost","seo":"SEO","spam":"Spam","rate_limits":"Limity a omezení","developer":"Vývojáři","embedding":"Embedding","legal":"Právní záležitosti","backups":"Zálohy"}},"badges":{"title":"Odznaky","new_badge":"Nový odznak","new":"Nové","name":"Jméno","badge":"Odznak","display_name":"Zobrazované jméno","description":"Popis","badge_type":"Typ odznaku","granted_by":"Uděleno","granted_at":"Uděleno v","save":"Uložit","delete":"Smazat","delete_confirm":"Určitě chcete tento oznak smazat?","revoke":"zrušit","revoke_confirm":"Určitě chcete tento odznak odejmout?","edit_badges":"Upravit odznaky","grant_badge":"Udělit odznak","granted_badges":"Udělené odznaky","grant":"Udělit","no_user_badges":"%{name} nezískal žádné oznaky.","no_badges":"Nejsou tu žádné odznaky, které by se dali rozdat.","multiple_grant":"Může být přiděleno několikrát"}},"lightbox":{"download":"download"},"keyboard_shortcuts_help":{"jump_to":{"title":"Jump To"},"navigation":{"title":"Navigation","back":"\u003cb\u003eu\u003c/b\u003e Back","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Move selection up/down","open":"\u003cb\u003eo\u003c/b\u003e or \u003cb\u003eEnter\u003c/b\u003e Open selected topic"},"application":{"title":"Application","create":"\u003cb\u003ec\u003c/b\u003e Create a new topic","notifications":"\u003cb\u003en\u003c/b\u003e Open notifications","search":"\u003cb\u003e/\u003c/b\u003e Search","help":"\u003cb\u003e?\u003c/b\u003e Open keyboard shortcuts help"},"actions":{"title":"Actions","star":"\u003cb\u003ef\u003c/b\u003e Star topic","share_topic":"\u003cb\u003eshift s\u003c/b\u003e Sdílet téma","reply_topic":"\u003cb\u003eshift r\u003c/b\u003e Odpovědět na téma","reply_post":"\u003cb\u003er\u003c/b\u003e Odpovědět na příspěvek","quote_post":"\u003cb\u003eq\u003c/b\u003e Citovat příspěvek","like":"\u003cb\u003el\u003c/b\u003e Like post","flag":"\u003cb\u003e!\u003c/b\u003e Flag post","bookmark":"\u003cb\u003eb\u003c/b\u003e Bookmark post","edit":"\u003cb\u003ee\u003c/b\u003e Edit post","delete":"\u003cb\u003ed\u003c/b\u003e Delete post"}},"badges":{"title":"Odznaky","badge_count":{"one":"1 odznak","few":"%{count} odznaky","other":"%{count} odznaků"},"more_badges":{"one":"+1 další","few":"+%{count} další","other":"+%{count} dalších"},"granted":{"one":"1 udělen","few":"1 udělen","other":"%{count} uděleno"},"select_badge_for_title":"Vyberte odznak, který chcete použít jako svůj titul","badge":{"basic_user":{"name":"Základní"},"regular_user":{"name":"Běžný"},"leader":{"name":"Vůdce"},"elder":{"name":"Starší"}}}}}};
I18n.locale = 'cs';
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
// locale : czech (cs)
// author : petrbela : https://github.com/petrbela

(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define(['moment'], factory); // AMD
    } else if (typeof exports === 'object') {
        module.exports = factory(require('../moment')); // Node
    } else {
        factory(window.moment); // Browser global
    }
}(function (moment) {
    var months = "leden_únor_březen_duben_květen_červen_červenec_srpen_září_říjen_listopad_prosinec".split("_"),
        monthsShort = "led_úno_bře_dub_kvě_čvn_čvc_srp_zář_říj_lis_pro".split("_");

    function plural(n) {
        return (n > 1) && (n < 5) && (~~(n / 10) !== 1);
    }

    function translate(number, withoutSuffix, key, isFuture) {
        var result = number + " ";
        switch (key) {
        case 's':  // a few seconds / in a few seconds / a few seconds ago
            return (withoutSuffix || isFuture) ? 'pár sekund' : 'pár sekundami';
        case 'm':  // a minute / in a minute / a minute ago
            return withoutSuffix ? 'minuta' : (isFuture ? 'minutu' : 'minutou');
        case 'mm': // 9 minutes / in 9 minutes / 9 minutes ago
            if (withoutSuffix || isFuture) {
                return result + (plural(number) ? 'minuty' : 'minut');
            } else {
                return result + 'minutami';
            }
            break;
        case 'h':  // an hour / in an hour / an hour ago
            return withoutSuffix ? 'hodina' : (isFuture ? 'hodinu' : 'hodinou');
        case 'hh': // 9 hours / in 9 hours / 9 hours ago
            if (withoutSuffix || isFuture) {
                return result + (plural(number) ? 'hodiny' : 'hodin');
            } else {
                return result + 'hodinami';
            }
            break;
        case 'd':  // a day / in a day / a day ago
            return (withoutSuffix || isFuture) ? 'den' : 'dnem';
        case 'dd': // 9 days / in 9 days / 9 days ago
            if (withoutSuffix || isFuture) {
                return result + (plural(number) ? 'dny' : 'dní');
            } else {
                return result + 'dny';
            }
            break;
        case 'M':  // a month / in a month / a month ago
            return (withoutSuffix || isFuture) ? 'měsíc' : 'měsícem';
        case 'MM': // 9 months / in 9 months / 9 months ago
            if (withoutSuffix || isFuture) {
                return result + (plural(number) ? 'měsíce' : 'měsíců');
            } else {
                return result + 'měsíci';
            }
            break;
        case 'y':  // a year / in a year / a year ago
            return (withoutSuffix || isFuture) ? 'rok' : 'rokem';
        case 'yy': // 9 years / in 9 years / 9 years ago
            if (withoutSuffix || isFuture) {
                return result + (plural(number) ? 'roky' : 'let');
            } else {
                return result + 'lety';
            }
            break;
        }
    }

    return moment.defineLocale('cs', {
        months : months,
        monthsShort : monthsShort,
        monthsParse : (function (months, monthsShort) {
            var i, _monthsParse = [];
            for (i = 0; i < 12; i++) {
                // use custom parser to solve problem with July (červenec)
                _monthsParse[i] = new RegExp('^' + months[i] + '$|^' + monthsShort[i] + '$', 'i');
            }
            return _monthsParse;
        }(months, monthsShort)),
        weekdays : "neděle_pondělí_úterý_středa_čtvrtek_pátek_sobota".split("_"),
        weekdaysShort : "ne_po_út_st_čt_pá_so".split("_"),
        weekdaysMin : "ne_po_út_st_čt_pá_so".split("_"),
        longDateFormat : {
            LT: "H.mm",
            L : "DD. MM. YYYY",
            LL : "D. MMMM YYYY",
            LLL : "D. MMMM YYYY LT",
            LLLL : "dddd D. MMMM YYYY LT"
        },
        calendar : {
            sameDay: "[dnes v] LT",
            nextDay: '[zítra v] LT',
            nextWeek: function () {
                switch (this.day()) {
                case 0:
                    return '[v neděli v] LT';
                case 1:
                case 2:
                    return '[v] dddd [v] LT';
                case 3:
                    return '[ve středu v] LT';
                case 4:
                    return '[ve čtvrtek v] LT';
                case 5:
                    return '[v pátek v] LT';
                case 6:
                    return '[v sobotu v] LT';
                }
            },
            lastDay: '[včera v] LT',
            lastWeek: function () {
                switch (this.day()) {
                case 0:
                    return '[minulou neděli v] LT';
                case 1:
                case 2:
                    return '[minulé] dddd [v] LT';
                case 3:
                    return '[minulou středu v] LT';
                case 4:
                case 5:
                    return '[minulý] dddd [v] LT';
                case 6:
                    return '[minulou sobotu v] LT';
                }
            },
            sameElse: "L"
        },
        relativeTime : {
            future : "za %s",
            past : "před %s",
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
        ordinal : '%d.',
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });
}));

moment.fn.shortDateNoYear = function(){ return this.format('D. MMM'); };
moment.fn.shortDate = function(){ return this.format('D. MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('D. MMMM YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};

I18n.pluralizationRules['cs'] = function (n) {
  if (n == 0) return ["zero", "none", "other"];
  if (n == 1) return "one";
  if (n >= 2 && n <= 4) return "few";
  return "other";
};
