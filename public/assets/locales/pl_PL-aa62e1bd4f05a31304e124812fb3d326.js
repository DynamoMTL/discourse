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
MessageFormat.locale.en = function ( n ) {
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
    })({"topic.read_more_MF" : function(){ return "Invalid Format: Plural Function not found for locale: pl_PL";}});I18n.translations = {"pl_PL":{"js":{"number":{"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"bajt","few":"bajty","other":"bajtów"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}}},"dates":{"time":"HH:mm","long_no_year":"DD MMM HH:mm","long_no_year_no_time":"DD MMM","long_with_year":"DD MMM YYYY HH:mm","long_with_year_no_time":"DD MMM YYYY","long_date_with_year":"DD MMM 'YY LT","long_date_without_year":"DD MMM, LT","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c 1s","few":"\u003c %{count}s","other":"\u003c %{count}s"},"x_seconds":{"one":"1s","few":"%{count}s","other":"%{count}s"},"less_than_x_minutes":{"one":"\u003c 1m","few":"\u003c %{count}m","other":"\u003c %{count}m"},"x_minutes":{"one":"1m","few":"%{count}m","other":"%{count}m"},"about_x_hours":{"one":"1h","few":"%{count}h","other":"%{count}h"},"x_days":{"one":"1d","few":"%{count}d","other":"%{count}d"},"about_x_years":{"one":"1r","few":"%{count}r","other":"%{count}r"},"over_x_years":{"one":"\u003e 1r","few":"\u003e %{count}r","other":"\u003e %{count}r"},"almost_x_years":{"one":"1r","few":"%{count}r","other":"%{count}r"},"date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"1 minuta","few":"%{count} minuty","other":"%{count} minut"},"x_hours":{"one":"1 godzina","few":"%{count} godziny","other":"%{count} godzin"},"x_days":{"one":"1 dzień","few":"%{count} dni","other":"%{count} dni"}},"medium_with_ago":{"x_minutes":{"one":"minutę temu","few":"%{count} minuty temu","other":"%{count} minut temu"},"x_hours":{"one":"godzinę temu","few":"%{count} godziny temu","other":"%{count} godzin temu"},"x_days":{"one":"wczoraj","few":"%{count} dni temu","other":"%{count} dni temu"}}},"share":{"topic":"udostępnij odnośnik do tego tematu","post":"udostępnij odnośnik do wpisu #%{postNumber}","close":"zamknij","twitter":"udostępnij ten odnośnik na Twitterze","facebook":"udostępnij ten odnośnik na Facebooku","google+":"udostępnij ten odnośnik na Google+","email":"wyślij ten odnośnik przez email"},"edit":"edytuj tytuł i kategorię tego tematu","not_implemented":"Bardzo nam przykro, ale ta funkcja nie została jeszcze zaimplementowana.","no_value":"Nie","yes_value":"Tak","generic_error":"Przepraszamy, wystąpił błąd.","generic_error_with_reason":"Wystąpił błąd: %{error}","sign_up":"Rejestracja","log_in":"Logowanie","age":"Wiek","joined":"Dołączył","admin_title":"Administracja","flags_title":"Flagi","show_more":"pokaż więcej","links":"Odnośniki","links_lowercase":"linki","faq":"FAQ","guidelines":"Przewodnik","privacy_policy":"Polityka prywatności","privacy":"Prywatność","terms_of_service":"Warunki użytkowania serwisu","mobile_view":"Wersja mobilna","desktop_view":"Wersja komputerowa","you":"Ty","or":"lub","now":"teraz","read_more":"więcej","more":"Więcej","less":"Mniej","never":"nigdy","daily":"dziennie","weekly":"tygodniowo","every_two_weeks":"co dwa tygodnie","max":"maks","character_count":{"one":"1 znak","few":"{{count}} znaki","other":"{{count}} znaków"},"in_n_seconds":{"one":"w sekundę","few":"w {{count}} sekundy","other":"w {{count}} sekund"},"in_n_minutes":{"one":"w minutę","few":"w {{count}} minuty","other":"w {{count}} minut"},"in_n_hours":{"one":"w godzinę","few":"w {{count}} godziny","other":"w {{count}} godzin"},"in_n_days":{"one":"w dzień","few":"w {{count}} dni","other":"w {{count}} dni"},"suggested_topics":{"title":"Sugerowane tematy"},"about":{"simple_title":"O stronie","title":"O %{title}","stats":"Statystyki strony","our_admins":"Administratorzy","our_moderators":"Moderatoratorzy","stat":{"all_time":"Ogółem","last_7_days":"Ostatnich 7 dni"},"like_count":"Liczba polubionych","topic_count":"Liczba tematów","post_count":"Liczba wpisów","user_count":"Liczba użytkowników"},"bookmarks":{"not_logged_in":"przykro nam, ale należy się zalogować, aby dodawać zakładki","created":"zakładka dodana","not_bookmarked":"wpis przeczytany: kliknij, aby dodać zakładkę","last_read":"to ostatni przeczytany przez ciebie wpis: kliknij, aby dodać zakładkę","remove":"Usuń zakładkę"},"topic_count_latest":{"one":"{{count}} nowy lub zaktualizowany temat","few":"{{count}} nowe lub zaktualizowane tematy","other":"{{count}} nowych lub zaktualizowanych tematów"},"topic_count_unread":{"one":"{{count}} nieprzeczytany temat.","few":"{{count}} nieprzeczytane tematy.","other":"{{count}} nieprzeczytanych tematów."},"topic_count_new":{"one":"{{count}} nowy temat.","few":"{{count}} nowe tematy.","other":"{{count}} nowych tematów."},"click_to_show":"Kliknij aby zobaczyć.","preview":"podgląd","cancel":"anuluj","save":"Zapisz zmiany","saving":"Zapisuję…","saved":"Zapisano!","upload":"Wgraj","uploading":"Wysyłam…","uploaded":"Wgrano!","enable":"Włącz","disable":"Wyłącz","undo":"Cofnij","revert":"Przywróć","banner":{"close":"Zamknij ten baner."},"choose_topic":{"none_found":"Nie znaleziono tematów.","title":{"search":"Szukaj tematu po nazwie, URL-u albo ID:","placeholder":"tutaj wpisz tytuł tematu"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e tworzy \u003ca href='{{topicUrl}}'\u003etemat\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eDodajesz\u003c/a\u003e \u003ca href='{{topicUrl}}'\u003etemat\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e odpowiada na \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eOdpowiadasz\u003c/a\u003e na \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e odpisuje na \u003ca href='{{topicUrl}}'\u003etemat\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eOdpowiadasz\u003c/a\u003e w \u003ca href='{{topicUrl}}'\u003etemacie\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e wspomina o \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e wspomniał o \u003ca href='{{user2Url}}'\u003etobie\u003c/a\u003e","you_mentioned_user":"\u003ca href=\"{{user1Url}}\"\u003eWspomniałeś/aś\u003c/a\u003e o użytkowniku \u003ca href=\"{{user2Url}}\"\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Wysłane przez \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Dodany przez \u003ca href='{{userUrl}}'\u003eciebie\u003c/a\u003e","sent_by_user":"Wysłano przez \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Wysłano przez \u003ca href='{{userUrl}}'\u003eCiebie\u003c/a\u003e"},"groups":{"visible":"Grupa jest widoczna dla wszystkich użytkowników","title":{"one":"grupa","few":"grupy","other":"grupy"},"members":"Członkowie","posts":"Wpisów","alias_levels":{"title":"Kto może użyć aliasu tej grupy?","nobody":"Nikt","only_admins":"Tylko administratorzy","mods_and_admins":"Tylko moderatorzy i administratorzy","members_mods_and_admins":"Tylko członkowie grupy, moderatorzy i administratorzy","everyone":"Wszyscy"}},"user_action_groups":{"1":"Przyznane polubienia","2":"Otrzymane polubienia","3":"Zakładki","4":"Tematy","5":"Wpisy","6":"Odpowiedzi","7":"Wzmianki","9":"Cytaty","10":"Oznaczone","11":"Edycje","12":"Wysłane","13":"Skrzynka odbiorcza"},"categories":{"all":"wszystkie kategorie","all_subcategories":"wszystkie","no_subcategory":"żadne","category":"Kategoria","posts":"Wpisy","topics":"Tematy","latest":"Ostatnie","latest_by":"najnowszy wpis: ","toggle_ordering":"przełącz kolejność kontroli","subcategories":"Podkategorie","topic_stats":"Liczba nowych tematów.","topic_stat_sentence":{"one":"ostatni %{unit}: %{count} nowy temat.","few":"ostatni %{unit}: %{count} nowe tematy.","other":"ostatni %{unit}: %{count} nowych tematów."},"post_stats":"Liczba nowych wpisów.","post_stat_sentence":{"one":"ostatni %{unit}: %{count} nowy wpis.","few":"ostatni %{unit}: %{count} nowe wpisy.","other":"ostatni %{unit}: %{count} nowych wpisów."}},"ip_lookup":{"title":"Wyszukiwanie adresu IP","hostname":"Nazwa hosta","location":"Lokalizacja","location_not_found":"(nieznane)","organisation":"Organizacja","phone":"Numer telefonu","other_accounts":"Inne konta z tym adresem IP","no_other_accounts":"(brak)"},"user":{"said":"{{username}} pisze:","profile":"Profil","mute":"Wycisz","edit":"Edytuj ustawienia","download_archive":"pobierz archiwum moich wpisów","private_message":"Prywatna wiadomość","private_messages":"Wiadomości","activity_stream":"Aktywność","preferences":"Ustawienia","bookmarks":"Zakładki","bio":"O mnie","invited_by":"Zaproszono przez","trust_level":"Poziom zaufania","notifications":"Powiadomienia","disable_jump_reply":"Po odpowiedzi nie skacz do twojego nowego wpisu ","dynamic_favicon":"Pokazuj powiadomienia o nowych wiadomościach na ikonie w karcie przeglądarki (eksperymentalne)","edit_history_public":"Pozwól innym oglądać historię edycji moich wpisów","external_links_in_new_tab":"Otwieraj wszystkie zewnętrzne odnośniki w nowej karcie","enable_quoting":"Włącz cytowanie zaznaczonego tekstu","change":"zmień","moderator":"{{user}} jest moderatorem","admin":"{{user}} jest adminem","moderator_tooltip":"Ten użytkownik jest moderatorem","admin_tooltip":"Ten użytkownik jest administratorem","suspended_notice":"ten użytkownik jest zawieszony do {{date}}.","suspended_reason":"Powód: ","watched_categories":"Obserwowane","watched_categories_instructions":"Będziesz automatycznie śledzić wszystkie nowe tematy w tych kategoriach: liczba nieprzeczytanych i nowych wpisów będzie wyświetlana obok tytułów na liście tematów. Dodatkowo będziesz otrzymywać powiadomienie o każdym nowym wpisie i temacie.","tracked_categories":"Śledzone","tracked_categories_instructions":"Będziesz automatycznie śledzić wszystkie nowe tematy w tych kategoriach: licznik nowych i nieprzeczytanych wpisów pojawi się obok tytułu na liście tematów.","muted_categories":"Wyciszone","muted_categories_instructions":"Nie będziesz powiadamiany o niczym dotyczącym nowych tematów w tych kategoriach, i nie będą się one pojawiać na karcie nieprzeczytanych.","delete_account":"Usuń moje konto","delete_account_confirm":"Czy na pewno chcesz usunąć swoje konto? To nieodwracalne!","deleted_yourself":"Twoje konto zostało usunięte.","delete_yourself_not_allowed":"Nie możesz usunąć swojego konta w tej chwili. Skontaktuj się z administratorem, by usunął Twoje konto za Ciebie.","unread_message_count":"Wiadomości","staff_counters":{"flags_given":"uczynnych oflagowań","flagged_posts":"oflagowane wpisy","deleted_posts":"usunięte wpisy","suspensions":"zawieszone"},"messages":{"all":"Wszystkie","mine":"Moje","unread":"Nieprzeczytane"},"change_password":{"success":"(email wysłany)","in_progress":"(email wysyłany)","error":"(błąd)","action":"Wyślij wiadomość email resetującą hasło","set_password":"Ustaw hasło"},"change_about":{"title":"Zmień O mnie"},"change_username":{"title":"Zmień nazwę użytkownika","confirm":"Jeżeli zmienisz swoją nazwę użytkownika, wszystkie stare cytaty twoich wpisów oraz wzmianki przez @nazwę przestaną działać. Czy na pewno tego chcesz?","taken":"Przykro nam, ale ta nazwa użytkownika jest zajęta.","error":"Podczas zmiany twojej nazwy użytkownika wystąpił błąd.","invalid":"Ta nazwa użytkownika jest niepoprawna. Powinna ona zawierać jedynie liczby i litery."},"change_email":{"title":"Zmień adres email","taken":"Przykro nam, ale ten adres email nie jest dostępny.","error":"Wystąpił błąd podczas próby zmiany twojego adresu email. Być może ten email jest już zarejestrowany?","success":"Wysłaliśmy wiadomość do potwierdzenia na podany adres email."},"change_avatar":{"title":"Zmień swój awatar","gravatar":"bazujący na \u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e","refresh_gravatar_title":"Zaktualizuj swój Gravatar","letter_based":"Awatar przyznany przez system","uploaded_avatar":"Zwyczajny obrazek","uploaded_avatar_empty":"Dodaj zwyczajny obrazek","upload_title":"Wgraj swoje zdjęcie","upload_picture":"Wgraj zdjęcie","image_is_not_a_square":"Uwaga: przycięliśmy twój obraz ponieważ nie był kwadratem."},"change_profile_background":{"title":"Tło profilu"},"email":{"title":"Email","instructions":"Nigdy nie będzie wyświetlony publicznie.","ok":"Wygląda dobrze. Wyślemy Ci wiadomość do potwierdzenia.","invalid":"Podaj poprawny adres email.","authenticated":"Twój adres email został potwierdzony przez {{provider}}.","frequency":"Wyślemy do Ciebie email tylko jeżeli dawno Cię nie widzieliśmy i wyłącznie na temat rzeczy których jeszcze nie widziałeś."},"name":{"title":"Pełna nazwa","instructions":"Pełna wersja twojej nazwy.","too_short":"Twoja nazwa użytkownika jest za krótka.","ok":"Twoja nazwa użytkownika jest poprawna."},"username":{"title":"Nazwa użytkownika","instructions":"Powinien być unikalny, krótki i bez spacji.","short_instructions":"Aby o tobie wspomnieć, wystarczy napisać @{{username}}.","available":"Ta nazwa użytkownika jest dostępna.","global_match":"Email zgadza się z zarejestrowaną nazwą użytkownika.","global_mismatch":"Zajęta. Może spróbuj {{suggestion}}?","not_available":"Niedostępna. Może spróbuj {{suggestion}}?","too_short":"Nazwa użytkownika jest za krótka.","too_long":"Nazwa użytkownika jest za długa.","checking":"Sprawdzanie, czy nazwa użytkownika jest dostępna…","enter_email":"Nazwa użytkownika znaleziona. Wpisz przypisany adres email.","prefilled":"Email zgadza się z zarejestrowaną nazwą użytkownika."},"locale":{"title":"Język interfejsu","instructions":"Język interfejsu użytkownika. Zmieni się, gdy odświeżysz stronę.","default":"(domyślny)"},"password_confirmation":{"title":"Powtórz hasło"},"last_posted":"Ostatni wpis","last_emailed":"Ostatnio otrzymał email","last_seen":"Ostatnio widziano","created":"Dołączył","log_out":"Wyloguj","location":"Lokalizacja","website":"Strona internetowa","email_settings":"Email","email_digests":{"title":"Gdy nie odwiedzam strony, wysyłaj email z nowościami:","daily":"codziennie","weekly":"co tydzień","bi_weekly":"co 2 tygodnie"},"email_direct":"Wyślij powiadomienie, kiedy ktoś mnie cytuje, odpowiada na mój wpis lub wspomina moją @nazwę","email_private_messages":"Wyślij powiadomienie, kiedy ktoś wyśle mi prywatną wiadomość","email_always":"Wysyłaj powiadomienia email nawet gdy przejawiam aktywność na forum","other_settings":"Inne","categories_settings":"Kategorie","new_topic_duration":{"label":"Uznaj, że temat jest nowy, jeśli","not_viewed":"jeszcze ich nie widziałeś","last_here":"dodane od twojej ostatniej wizyty","after_n_days":{"one":"dodane w ciągu ostatniego dnia","few":"dodane w ciągu ostatnich {{count}} dni","other":"dodane w ciągu ostatnich {{count}} dni"},"after_n_weeks":{"one":"dodane w ciągu ostatniego tygodnia","few":"dodane w ciągu ostatnich {{count}} tygodni","other":"dodane w ciągu ostatnich {{count}} tygodni"}},"auto_track_topics":"Automatycznie śledź tematy które odwiedzam","auto_track_options":{"never":"nigdy","always":"zawsze","after_n_seconds":{"one":"po 1 sekundzie","few":"po {{count}} sekundach","other":"po {{count}} sekundach"},"after_n_minutes":{"one":"po 1 minucie","few":"po {{count}} minutach","other":"po {{count}} minutach"}},"invited":{"search":"wpisz aby szukać zaproszeń…","title":"Zaproszenia","user":"Zaproszony(-a) użytkownik(-czka)","none":"Jeszcze nikt nie został przez ciebie zaproszony.","truncated":"Pokaż pierwsze {{count}} zaproszeń.","redeemed":"Cofnięte zaproszenia","redeemed_at":"Przyjęte","pending":"Oczekujące zaproszenia","topics_entered":"Obejrzane tematy","posts_read_count":"Przeczytane wpisy","expired":"To zaproszenie wygasło.","rescind":"Usuń","rescinded":"Zaproszenie usunięte","time_read":"Czas odczytu","days_visited":"Dni odwiedzin","account_age_days":"Wiek konta w dniach","create":"Wyślij zaproszenie","bulk_invite":{"none":"Jeszcze nikogo nie zaproszono. Możesz wysłać pojedyncze zaproszenie lub \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003ezaprosić wiele osób na raz wysyłając odpowiedni plik\u003c/a\u003e.","text":"Zaproszenia hurtowe z pliku","uploading":"WYSYŁANE","success":"Plik został przesłany pomyślnie, wkrótce dostaniesz powiadomienie z postępem.","error":"Podczas przesyłania wystąpił błąd '{{filename}}': {{message}}"}},"password":{"title":"Hasło","too_short":"Hasło jest za krótkie.","common":"To hasło jest zbyt popularne.","ok":"Twoje hasło jest poprawne.","instructions":"Musi zawierać co najmniej %{count} znaków."},"ip_address":{"title":"Ostatni adres IP"},"registration_ip_address":{"title":"Adres IP rejestracji"},"avatar":{"title":"Awatar"},"title":{"title":"Tytuł"},"filters":{"all":"Wszystkie"},"stream":{"posted_by":"Wysłane przez","sent_by":"Wysłane przez","private_message":"prywatna wiadomość","the_topic":"temat"}},"loading":"Wczytuję…","errors":{"prev_page":"podczas próby wczytania","reasons":{"network":"Błąd sieci","server":"błąd serwera","forbidden":"Brak dostępu","unknown":"Błąd"},"desc":{"network":"Sprawdź swoje połączenie.","network_fixed":"Chyba już w porządku.","server":"Kod błędu: {{status}}","unknown":"Coś poszło nie tak."},"buttons":{"back":"Cofnij","again":"Spróbuj ponownie","fixed":"Załaduj stronę"}},"close":"Zamknij","assets_changed_confirm":"Serwis został zmieniony, czy pozwolisz na przeładowanie strony w celu aktualizacji do najnowszej wersji?","read_only_mode":{"enabled":"Administrator włączył tryb tylko do odczytu. Możesz przeglądać serwis, jednak zmiany nie będą możliwe.","login_disabled":"Logowanie jest zablokowane, gdy strona jest w trybie tylko do odczytu."},"learn_more":"dowiedz się więcej…","year":"rok","year_desc":"tematy dodane w ciągu ostatnich 365 dni","month":"miesiąc","month_desc":"tematy dodane w ciągu ostatnich 30 dni","week":"tydzień","week_desc":"tematy dodane w ciągu ostatnich 7 dni","day":"dzień","first_post":"Pierwszy wpis","mute":"Wycisz","unmute":"Wyłącz wyciszenie","last_post":"Ostatni wpis","last_post_lowercase":"ostatni wpis","summary":{"description":"Istnieją \u003cb\u003e{{count}}\u003c/b\u003e odpowiedzi.","description_time":"Istnieją \u003cb\u003e{{count}}\u003c/b\u003e odpowiedzi z czasem czytania oszacowanym na \u003cb\u003e{{readingTime}} minut\u003c/b\u003e.","enable":"Podsumuj ten temat","disable":"Pokaż wszystkie wpisy"},"deleted_filter":{"enabled_description":"Ten temat posiada usunięte wpisy, które zostały ukryte.","disabled_description":"Usunięte wpisy w tym temacie są widoczne.","enable":"Ukryj usunięte wpisy","disable":"Pokaż usunięte wpisy."},"private_message_info":{"title":"Prywatna wiadomość","invite":"Zaproś innych","remove_allowed_user":"Czy naprawdę chcesz usunąć {{name}} z tej prywatnej wiadomości?"},"email":"Email","username":"Nazwa użytkownika","last_seen":"Ostatnio oglądane","created":"Utworzono","created_lowercase":"utworzono","trust_level":"Poziom zaufania","search_hint":"nazwa użytkownika lub email","create_account":{"title":"Utwórz Konto","failed":"Coś poszło nie tak, możliwe, że wybrany adres email jest już zarejestrowany, spróbuj użyć odnośnika przypomnienia hasła"},"forgot_password":{"title":"Zapomniane hasło","action":"Zapomniałem(-łam) hasła","invite":"Wpisz swoją nazwę użytkownika lub adres email. Wyślemy do ciebie email z linkiem do zresetowania hasła.","reset":"Resetuj hasło","complete_username":"Jeśli jakieś mamy konto o nazwie użytkownika \u003cb\u003e%{username}\u003c/b\u003e, za chwilę zostanie wysłana wiadomość z instrukcją jak ustawić nowe hasło.","complete_email":"Jeśli jakieś konto użytkownika posiada adres \u003cb\u003e%{email}\u003c/b\u003e, za chwilę zostanie wysłana wiadomość z instrukcją jak ustawić nowe hasło."},"login":{"title":"Logowanie","username":"Użytkownik","password":"Hasło","email_placeholder":"adres email lub nazwa użytkownika","caps_lock_warning":"Caps Lock jest włączony","error":"Nieznany błąd","blank_username_or_password":"Podaj swój email lub nazwę użytkownika i hasło","reset_password":"Resetuj hasło","logging_in":"Uwierzytelnianie…","or":"Lub","authenticating":"Uwierzytelnianie…","awaiting_confirmation":"Twoje konto czeka na aktywację. Użyj odnośnika przypomnienia hasła, aby otrzymać kolejny email aktywujący konta.","awaiting_approval":"Twoje konto jeszcze nie zostało zatwierdzone przez osoby z obsługi. Otrzymasz email gdy zostanie zatwierdzone.","requires_invite":"Przepraszamy, dostęp do tego forum jest tylko za zaproszeniem.","not_activated":"Nie możesz się jeszcze zalogować. Wysłaliśmy email aktywujący konto na adres \u003cb\u003e{{sentTo}}\u003c/b\u003e. W celu aktywacji konta postępuj zgodnie z instrukcjami otrzymanymi w emailu.","resend_activation_email":"Kliknij tutaj, aby ponownie wysłać email z aktywacją konta.","sent_activation_email_again":"Wysłaliśmy do ciebie kolejny email z aktywacją konta na \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Zanim dotrze, może minąć kilka minut; pamiętaj, żeby sprawdzić folder ze spamem.","google":{"title":"przez Google","message":"Uwierzytelnianie przy pomocy konta Google (upewnij się, że blokada wyskakujących okienek nie jest włączona)"},"google_oauth2":{"title":"przez Google","message":"Uwierzytelniam przy pomocy Google (upewnij się wyskakujące okienka nie są blokowane)"},"twitter":{"title":"przez Twitter","message":"Uwierzytelnianie przy pomocy konta na Twitterze (upewnij się, że blokada wyskakujących okienek nie jest włączona)"},"facebook":{"title":"przez Facebook","message":"Uwierzytelnianie przy pomocy konta Facebook (upewnij się, że blokada wyskakujących okienek nie jest włączona)"},"yahoo":{"title":"przez Yahoo","message":"Uwierzytelnianie przy pomocy konta Yahoo (upewnij się, że blokada wyskakujących okienek nie jest włączona)"},"github":{"title":"przez GitHub","message":"Uwierzytelnianie przez GitHub (upewnij się, że blokada wyskakujących okienek nie jest włączona)"}},"composer":{"posting_not_on_topic":"W którym temacie chcesz odpowiedzieć?","saving_draft_tip":"zapisywanie","saved_draft_tip":"zapisano","saved_local_draft_tip":"zapisano lokalnie","similar_topics":"Twój temat jest podobny do…","drafts_offline":"szkice offline","min_length":{"need_more_for_title":"jeszcze co najmniej {{n}} znaków w tytule","need_more_for_reply":"jeszcze co najmniej {{n}} znaków"},"error":{"title_missing":"tytuł jest wymagany","title_too_short":"tytuł musi zawierać co najmniej {{min}} znaków","title_too_long":"Tytuł nie może zawierać więcej niż {{max}} znaków","post_missing":"wpis nie może być pusty","post_length":"Wpis musi zawierać przynajmniej {{min}} znaków","category_missing":"Musisz wybrać kategorię"},"save_edit":"Zapisz zmiany","reply_original":"Odpowiedz na Oryginalny Temat","reply_here":"Odpowiedz tutaj","reply":"Odpowiedz","cancel":"Anuluj","create_topic":"Utwórz temat","create_pm":"Utwórz prywatną wiadomość","title":"Lub naciśnij Ctrl+Enter","users_placeholder":"Dodaj osobę","title_placeholder":"O czym jest ta dyskusja w jednym zwartym zdaniu. ","edit_reason_placeholder":"z jakiego powodu edytujesz?","show_edit_reason":"(dodaj powód edycji)","reply_placeholder":"Tu wprowadź treść. Użyj składni Markdown lub BBCode do formatowania tekstu. Przeciągnij lub wklej obraz, aby go wgrać.","view_new_post":"Zobacz Twój nowy wpis.","saving":"Zapisuję…","saved":"Zapisano!","saved_draft":"Posiadasz zachowany szkic wpisu. Kliknij tu aby wznowić jego edycję.","uploading":"Wczytuję…","show_preview":"pokaż podgląd \u0026raquo;","hide_preview":"\u0026laquo; schowaj podgląd","quote_post_title":"Cytuj cały wpis","bold_title":"Pogrubienie","bold_text":"pogrubiony tekst","italic_title":"Wyróżnienie","italic_text":"wyróżniony tekst","link_title":"Odnośnik","link_description":"wprowadź tutaj opis odnośnika","link_dialog_title":"Wstaw odnośnik","link_optional_text":"opcjonalny tytuł","quote_title":"Cytat","quote_text":"Cytat","code_title":"Tekst sformatowany","code_text":"Sformatowany blok tekstu poprzedź 4 spacjami","upload_title":"Wgraj","upload_description":"wprowadź opis tutaj","olist_title":"Lista numerowana","ulist_title":"Lista wypunktowana","list_item":"Element listy","heading_title":"Nagłówek","heading_text":"Nagłówek","hr_title":"Pozioma linia","undo_title":"Cofnij","redo_title":"Ponów","help":"Pomoc formatowania Markdown","toggler":"ukryj lub pokaż panel kompozytora tekstu","admin_options_title":"Opcjonalne ustawienia obsługi dla tego tematu","auto_close_label":"Czas automatycznego zamknięcia tematu:","auto_close_units":"(liczba godzin, czas lub data i czas)","auto_close_examples":"podaj bezwzględny czas lub liczbę godzin — 24, 17:00, 2013-11-22 14:00","auto_close_error":"Proszę podaj poprawną wartość."},"notifications":{"title":"powiadomienia dla wspomnień przy użyciu @nazwy, odpowiedzi do twoich wpisów i tematów, prywatne wiadomości, itp","none":"Aktualnie nie masz żadnych powiadomień.","more":"pokaż starsze powiadomienia","total_flagged":"wszystkie oflagowane wpisy","mentioned":"\u003ci title='wspomnienie' class='icon'\u003e@\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='cytat' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='odpowiedź' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='odpowiedź' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='edycja' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='polubienie' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","private_message":"\u003ci title='prywatna wiadomość' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='prywatna wiadomość' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='przyjęcie twojego zaproszenia' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e przyjmuje twoje zaproszenie\u003c/p\u003e","moved_post":"\u003ci title='przeniesienie wpisu' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e przenosi {{description}}\u003c/p\u003e","linked":"\u003ci title='powiązany wpis' class='fa fa-arrow-left'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","granted_badge":"\u003ci title='otrzymano odznakę' class='fa fa-certificate'\u003e\u003c/i\u003e\u003cp\u003eOtrzymujesz '{{description}}'\u003c/p\u003e"},"upload_selector":{"title":"Dodaj obraz","title_with_attachments":"Dodaj obraz lub plik","from_my_computer":"Z mojego urządzenia","from_the_web":"Z Internetu","remote_tip":"odnośnik do obrazu http://example.com/image.jpg","remote_tip_with_attachments":"odnośnik do obrazu lub pliku http://example.com/file.ext (dozwolone rozszerzenia: {{authorized_extensions}}).","local_tip":"kliknij, aby wybrać obraz z Twojego urządzenia","local_tip_with_attachments":"kliknij, aby wybrać obraz lub plik z Twojego urządzenia (dozwolone rozszerzenia: {{authorized_extensions}})","hint":"(możesz także upuścić plik z katalogu komputera w okno edytora)","hint_for_supported_browsers":"(możesz przeciągnąć lub wkleić obrazy do edytora, aby je wgrać)","uploading":"Wgrywanie","image_link":"odnośnik do którego Twój obraz będzie kierował"},"search":{"title":"szukaj tematów, wpisów, użytkowników lub kategorii","no_results":"Brak wyników wyszukiwania","searching":"Szukam…","post_format":"#{{post_number}} za {{username}}","context":{"user":"Szukaj wpisów @{{username}}","category":"Szukaj w kategorii \"{{category}}\"","topic":"Szukaj w tym temacie"}},"site_map":"przejdź do innej listy tematów lub kategorii","go_back":"wróć","not_logged_in_user":"strona użytkownika z podsumowaniem bieżących działań i ustawień","current_user":"idź do swojej strony użytkowanika","starred":{"title":"Oznacz","help":{"star":"oznacz ten temat gwiazdką","unstar":"usuń ten temat z listy oznaczonych gwiazdką"}},"topics":{"bulk":{"reset_read":"Wyzeruj przeczytane","delete":"Usuń tematy","dismiss_posts":"Wyczyść liczniki wpisów","dismiss_posts_tooltip":"Wyczyść liczniki nieprzeczytanych wpisów w tych tematach, ale informuj mnie jeśli pojawią się w nich nowe wpisy w przyszłości.","dismiss_topics":"Wyczyść status termatów","dismiss_topics_tooltip":"Nie pokazuj tych tematów na mojej liście nieprzeczytanych gdy pojawią się w nich nowe wpisy.","dismiss_new":"Zignoruj nowe","toggle":"włącz grupowe zaznaczanie tematów","actions":"Operacje grupowe","change_category":"Zmień kategorię","close_topics":"Zamknij wpisy","notification_level":"Poziom powiadomień o zmianach","selected":{"one":"Zaznaczono \u003cb\u003e1\u003c/b\u003e temat.","few":"Zaznaczono \u003cb\u003e{{count}}\u003c/b\u003e tematy.","other":"Zaznaczono \u003cb\u003e{{count}}\u003c/b\u003e tematów."}},"none":{"starred":"Nie oznaczyłeś gwiazdkami żadnych tematów. By oznaczyć temat, kliknij lub dotknij gwiazdkę obok jego tytułu.","unread":"Nie masz nieprzeczytanych tematów.","new":"Nie masz nowych tematów.","read":"You haven't read any topics yet.","posted":"Jeszcze nie zamieściłeś wpisu w żadnym z tematów.","latest":"Nie ma najnowszych tematów. Smutne.","hot":"Nie ma gorących tematów.","category":"Nie ma tematów w kategorii {{category}}.","top":"Brak najlepszych tematów.","educate":{"new":"\u003cp\u003eDomyślnie, tematy są traktowane jako nowe jeśli zostały utworzone w ciągu ostatnich 2 dni.\u003c/p\u003e\u003cp\u003eMożesz to zmienić w \u003ca href=\"%{userPrefsUrl}\"\u003eswoich ustawieniach\u003c/a\u003e.\u003c/p\u003e","unread":"\u003cp\u003eDomyślnie, pojawiają się tu tematy:\u003c/p\u003e\u003cul\u003e\u003cli\u003etwojego autorstwa\u003c/li\u003e\u003cli\u003ete w których są twoje odpowiedzi \u003c/li\u003e\u003cli\u003eczytane przez ciebie dłużej niż 4 minuty\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eZnajdą się tu też te, którym ręcznie przyznano status Śledzony lub Obserwowany przyciskiem znajdującym się na końcu każdego tematu.\u003c/p\u003e\u003cp\u003eMożesz zmienić te zachowania w swoich \u003ca href=\"%{userPrefsUrl}\"\u003epreferencjach\u003c/a\u003e.\u003c/p\u003e"}},"bottom":{"latest":"Nie ma więcej najnowszych tematów.","hot":"Nie ma więcej gorących tematów.","posted":"Nie ma więcej tematów w których pisałeś.","read":"Nie ma więcej przeczytanych tematów.","new":"Nie ma więcej nowych tematów.","unread":"Nie ma więcej nieprzeczytanych tematów.","starred":"Nie ma więcej oznaczonych tematów.","category":"Nie ma więcej tematów w kategorii {{category}}.","top":"Nie ma już więcej najlepszych tematów."}},"topic":{"filter_to":"{{post_count}} wpisów w temacie","create":"Utwórz temat","create_long":"Utwórz nowy temat","private_message":"Napisz Prywatną Wiadomość","list":"Tematy","new":"nowy temat","unread":"nieprzeczytane","new_topics":{"one":"1 nowy temat","few":"{{count}} nowe tematy","other":"{{count}} nowych tematów"},"unread_topics":{"one":"1 nieprzeczytany temat","few":"{{count}} nieprzeczytane tematy","other":"{{count}} nieprzeczytanych tematów"},"title":"Temat","loading_more":"Wczytuję więcej tematów…","loading":"Wczytuję temat…","invalid_access":{"title":"Temat jest prywatny","description":"Przepraszamy, nie masz dostępu do tego tematu!","login_required":"Musisz się zalogować, aby zobaczyć ten temat."},"server_error":{"title":"Wystąpił błąd przy wczytywaniu Tematu","description":"Przepraszamy, nie możliwe było wczytanie tematu, możliwe że wystąpił problem z połączeniem. Prosimy, spróbuj ponownie. Jeżeli problem wystąpi ponownie, powiadom administrację."},"not_found":{"title":"Temat nie został znaleziony","description":"Przepraszamy, ale temat nie został znaleziony. Możliwe, że został usunięty przez moderatora?"},"total_unread_posts":{"one":"masz 1 nieprzeczytany wpis w tym temacie","few":"masz {{count}} nieprzeczytane wpisy w tym temacie","other":"masz {{count}} nieprzeczytanych wpisów w tym temacie"},"unread_posts":{"one":"masz 1 nieprzeczytany wpis w tym temacie","few":"masz {{count}} nieprzeczytane wpisy w tym temacie","other":"masz {{count}} nieprzeczytanych wpisów w tym temacie"},"new_posts":{"one":"od Twoich ostatnich odwiedzin pojawił się 1 nowy wpis","few":"od Twoich ostatnich odwiedzin pojawiły się {{count}} nowe wpisy","other":"od Twoich ostatnich odwiedzin pojawiło się {{count}} nowych wpisów"},"likes":{"one":"temat zawiera 1 polubienie","few":"temat zawiera {{count}} polubienia","other":"temat zawiera {{count}} polubień"},"back_to_list":"Wróć do Listy Tematów","options":"Opcje tematu","show_links":"pokaż odnośniki z tego tematu","toggle_information":"przełącz szczegóły tematu","read_more_in_category":"Chcesz przeczytać więcej? Przeglądaj inne tematy w {{catLink}} lub {{latestLink}}.","read_more":"Chcesz przeczytać więcej? {{catLink}} lub {{latestLink}}.","browse_all_categories":"Przeglądaj wszystkie kategorie","view_latest_topics":"pokaż ostatnie tematy","suggest_create_topic":"Może rozpoczniesz temat?","jump_reply_up":"przeskocz do wcześniejszej odpowiedzi","jump_reply_down":"przeskocz do późniejszej odpowiedzi","deleted":"Temat został usunięty","auto_close_notice":"Ten temat zostanie automatycznie zamknięty %{timeLeft}.","auto_close_title":"Ustawienia automatycznego zamykania","auto_close_save":"Zapisz","auto_close_remove":"Nie zamykaj automatycznie tego tematu","progress":{"title":"postęp tematu","go_top":"początek","go_bottom":"koniec","go":"idź","jump_bottom_with_number":"przeskocz do wpisu %{post_number}","total":"w sumie wpisów","current":"obecny wpis","position":"wpis %{current} z %{total}"},"notifications":{"reasons":{"3_6":"Będziesz otrzymywać powiadomienia o każdym nowym wpisie i temacie, ponieważ obserwujesz tę kategorię.","3_5":"Będziesz otrzymywać powiadomienia o każdym nowym wpisie, ponieważ włączono automatyczne obserwowanie tego tematu.","3_2":"Będziesz otrzymywać powiadomienia o każdym nowym wpisie, ponieważ obserwujesz ten temat.","3_1":"Będziesz otrzymywać powiadomienia, ponieważ jesteś autorem tego tematu.","3":"Będziesz otrzymywać powiadomienia o każdym nowym wpisie, ponieważ obserwujesz ten temat.","2_8":"Będziesz otrzymywać powiadomienia, ponieważ śledzisz tę kategorię.","2_4":"Będziesz otrzymywać powiadomienia, ponieważ jesteś autorem odpowiedzi w tym temacie.","2_2":"Będziesz otrzymywać powiadomienia, ponieważ śledzisz ten temat.","2":"Będziesz otrzymywać powiadomienia, ponieważ \u003ca href=\"/users/{{username}}/preferences\"\u003eten temat został uznany za przeczytany\u003c/a\u003e.","1_2":"Dostaniesz powiadomienie jedynie gdy ktoś wspomni twoją @nazwę lub odpowie na twój wpis.","1":"Dostaniesz powiadomienie jedynie gdy ktoś wspomni twoją @nazwę lub odpowie na twój wpis.","0_7":"Ignorujesz wszystkie powiadomienia z tej kategorii.","0_2":"Ignorujesz wszystkie powiadomienia w tym temacie.","0":"Ignorujesz wszystkie powiadomienia w tym temacie."},"watching_pm":{"title":"Obserwuj wszystko","description":"Dostaniesz powiadomienie o każdym nowym wpisie w tej prywatnej dyskusji. Liczba nowych i nieprzeczytanych wpisów pojawi się obok jej tytułu na liście tematów."},"watching":{"title":"Obserwuj wszystko","description":"Dostaniesz powiadomienie o każdym nowym wpisie w tym temacie. Liczba nowych i nieprzeczytanych wpisów pojawi się obok jego tytułu na liście tematów."},"tracking_pm":{"title":"Śledzenie","description":"Licznik nowych i nieprzeczytanych wpisów pojawi się obok prywatnej wiadomości. Dostaniesz powiadomienie jedynie gdy ktoś wspomni twoją @nazwę lub odpowie na twój wpis."},"tracking":{"title":"Śledzenie","description":"Licznik nowych i nieprzeczytanych wpisów pojawi się obok tytułu tego tematu. Dostaniesz powiadomienie jedynie gdy ktoś wspomni twoją @nazwę lub odpowie na twój wpis."},"regular":{"title":"Normalny","description":"Dostaniesz powiadomienie jedynie gdy ktoś wspomni twoją @nazwę lub odpowie na twój wpis."},"regular_pm":{"title":"Normalny","description":"Dostaniesz powiadomienie jedynie gdy ktoś wspomni twoją @nazwę lub odpowie na twój wpis w prywatnej wiadomości."},"muted_pm":{"title":"Wyciszono","description":"Nie będziesz dostawać jakichkolwiek powiadomień dotyczących tej prywatnej wiadomości."},"muted":{"title":"Wyciszenie","description":"Nie będzie jakichkolwiek powiadomień dotyczących tego tematu i nie będzie się on pojawiać na karcie nieprzeczytanych."}},"actions":{"recover":"Przywróć temat","delete":"Usuń temat","open":"Otwórz temat","close":"Zamknij temat","auto_close":"Zamknij automatycznie","make_banner":"Ustaw jako baner","remove_banner":"Wyłącz ten baner","unpin":"Odepnij temat","pin":"Przypnij temat","pin_globally":"Przypnij temat globalnie","unarchive":"Przywróć z archiwum","archive":"Archiwizuj temat","invisible":"Uczyń niewidocznym","visible":"Uczyń widocznym","reset_read":"Zresetuj przeczytane dane","multi_select":"Wybierz wpisy"},"reply":{"title":"Odpowiedz","help":"zacznij pisać odpowiedź"},"clear_pin":{"title":"Odepnij","help":"Odepnij ten temat. Przestanie wyświetlać się na początku listy tematów."},"share":{"title":"Udostępnij","help":"udostępnij odnośnik do tego tematu"},"flag_topic":{"title":"Zgłoś","help":"zgłoś ten temat, aby zwrócić uwagę moderacji lub wyślij powiadomienie o nim","success_message":"Ten temat został pomyślnie zgłoszony."},"inviting":"Zapraszam…","automatically_add_to_groups_optional":"To zaproszenie daje dostęp do tych grup: (opcjonalne, tylko dla admina)","automatically_add_to_groups_required":"To zaproszenie daje dostęp do tych grup: (\u003cb\u003eWymagane\u003c/b\u003e, tylko dla admina)","invite_private":{"title":"Zaproś do pisanie Prywatnej Wiadomości","email_or_username":"Adres email lub nazwa użytkownika zapraszanej osoby","email_or_username_placeholder":"adres email lub nazwa użytkownika","action":"Zaproś","success":"Wskazany użytkownik został zaproszony do udziału w tej prywatnej dyskusji.","error":"Przepraszamy, wystąpił błąd w trakcie zapraszania użytkownika(-czki).","group_name":"nazwa grupy"},"invite_reply":{"title":"Zaproś","action":"Zaproś przez e-mail","help":"wyślij zaproszenia do znajomych by mogli odpowiedzieć na ten temat jednym kliknięciem","to_topic":"Wyślemy krótki email pozwalający twojemu znajomemu błyskawicznie odpowiedzieć w tym temacie przez kliknięcie w link (bez logowania).","to_forum":"Wyślemy krótki email pozwalający twojemu znajomemu błyskawicznie dołączyć przez kliknięcie w link (bez logowania).","email_placeholder":"nazwa@example.com","success":"Wysłaliśmy zaproszenie do \u003cb\u003e{{email}}\u003c/b\u003e. Powiadomimy cię gdy zaproszenie zostanie przyjęte. Status swoich zaproszeń możesz śledzić na dedykowanej zakładce w swoim profilu.","error":"Przepraszamy, nie mogliśmy zaprosić tej osoby. Być może jest już na forum?"},"login_reply":"Zaloguj się, aby odpowiedzieć","filters":{"n_posts":{"one":"1 wpis","few":"{{count}} wpisy","other":"{{count}} wpisów"},"cancel":"Pokaż ponownie wszystkie wpisy w tym temacie."},"split_topic":{"title":"Przenieś do nowego tematu","action":"przenieś do nowego tematu","topic_name":"Nazwa Nowego Tematu","error":"Wystąpił błąd podczas przenoszenia wpisów do nowego tematu.","instructions":{"one":"Masz zamiar utworzyć nowy temat, składający się z wybranego przez ciebie wpisu.","few":"Masz zamiar utworzyć nowy temat, składający się z \u003cb\u003e{{count}}\u003c/b\u003e wybranych przez ciebie wpisów.","other":"Masz zamiar utworzyć nowy temat, składający się z \u003cb\u003e{{count}}\u003c/b\u003e wybranych przez ciebie wpisów."}},"merge_topic":{"title":"Przenieś do Istniejącego Tematu","action":"przenieś do istniejącego tematu","error":"Wystąpił błąd podczas przenoszenia wpisów do danego tematu.","instructions":{"one":"Wybierz temat, do którego chcesz przenieś ten wpis.","few":"Wybierz temat, do którego chcesz przenieść wybrane \u003cb\u003e{{count}}\u003c/b\u003e wpisy.","other":"Wybierz temat, do którego chcesz przenieść \u003cb\u003e{{count}}\u003c/b\u003e wybranych wpisów."}},"change_owner":{"title":"Zmień właściciela wpisów","action":"zmień właściciela","error":"Wystąpił błąd podczas zmiany właściciela wpisów.","label":"Nowy właściciel wpisów","placeholder":"nazwa użytkownika nowego właściciela","instructions":{"one":"Wybierz nowego właściciela wpisu autorstwa \u003cb\u003e{{old_user}}\u003c/b\u003e.","few":"Wybierz nowego właściciela dla {{count}} wpisów autorstwa \u003cb\u003e{{old_user}}\u003c/b\u003e.","other":"Wybierz nowego właściciela dla {{count}} wpisów autorstwa \u003cb\u003e{{old_user}}\u003c/b\u003e."},"instructions_warn":"Przeszłe powiadomienia dla tego wpisu nie zostaną przypisane do nowego użytkownika. \u003cbr\u003eUwaga: Aktualnie, żadne dane uzależnione od wpisu nie są przenoszone do nowego użytkownika. Zachowaj ostrożność."},"multi_select":{"select":"wybierz","selected":"wybrano ({{count}})","select_replies":"wybierz +replies","delete":"usuń wybrane","cancel":"anuluj wybieranie","select_all":"zaznacz wszystkie","deselect_all":"odznacz wszystkie","description":{"one":"Wybrano \u003cb\u003e1\u003c/b\u003e wpis.","few":"Wybrano \u003cb\u003e{{count}}\u003c/b\u003e wpisy.","other":"Wybrano \u003cb\u003e{{count}}\u003c/b\u003e wpisów."}}},"post":{"reply":"Odpowiedz na {{link}} napisany przez {{replyAvatar}} {{username}}","reply_topic":"Odpowiedź na {{link}}","quote_reply":"odpowiedz na ten cytat","edit":"Edytuj {{link}} napisany przez {{replyAvatar}} {{username}}","edit_reason":"Powód","post_number":"wpis {{number}}","in_reply_to":"w odpowiedzi na","last_edited_on":"ostatnia edycja wpisu","reply_as_new_topic":"Odpowiedz w nowym temacie","continue_discussion":"Kontynuuj dyskusję z {{postLink}}:","follow_quote":"idź do cytowanego wpisu","show_full":"Pokaż pełny wpis","show_hidden":"Zobacz ukrytą zawartość.","deleted_by_author":{"one":"(wpis wycofany przez autora, zostanie automatycznie usunięty za %{count} godzinę, chyba że zostanie oflagowany) ","few":"(wpis wycofany przez autora, zostanie automatycznie usunięty za %{count} godziny, chyba że zostanie oflagowany) ","other":"(wpis wycofany przez autora, zostanie automatycznie usunięty za %{count} godzin, chyba że zostanie oflagowany) "},"expand_collapse":"rozwiń/zwiń","gap":{"one":"1 ukryty wpis","few":"{{count}} ukryte wpisy","other":"{{count}} ukrytych wpisów"},"more_links":"{{count}} więcej…","unread":"Nieprzeczytany wpis","has_replies":{"one":"Odpowiedź","few":"Odpowiedzi","other":"Odpowiedzi"},"errors":{"create":"Przepraszamy, podczas tworzenia twojego wpisu wystąpił błąd. Spróbuj ponownie.","edit":"Przepraszamy, podczas edytowania twojego wpisu wystąpił błąd. Spróbuj ponownie.","upload":"Przepraszamy, wystąpił błąd podczas wczytywania Twojego pliku. Proszę, spróbuj ponownie.","attachment_too_large":"Przepraszamy, ale plik, który chcesz wgrać jest za duży (maksymalny rozmiar to {{max_size_kb}}KB).","image_too_large":"Przepraszamy, ale obraz, który chcesz wgrać jest za duży (maksymalny rozmiar to {{max_size_kb}}KB), proszę zmień jego rozmiar i spróbuj ponownie.","too_many_uploads":"Przepraszamy, ale możesz wgrać tylko jeden plik naraz.","upload_not_authorized":"Przepraszamy, ale plik który chcesz wgrać jest niedozwolony (dozwolone rozszerzenia: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Przepraszamy, ale nowi użytkownicy nie mogą wgrywać obrazów.","attachment_upload_not_allowed_for_new_user":"Przepraszamy, ale nowi użytkownicy nie mogą wgrywać załączników."},"abandon":{"confirm":"Czy na pewno chcesz porzucić ten wpis?","no_value":"Nie, pozostaw","yes_value":"Tak, porzuć"},"wiki":{"about":"to wpis typu Wiki:  zwykli użytkownicy mogą go edytować"},"archetypes":{"save":"Opcje zapisu"},"controls":{"reply":"zacznij tworzyć odpowiedź na ten wpis","like":"polub ten wpis","has_liked":"polubiono ten wpis","undo_like":"wycofaj polubienie","edit":"edytuj ten wpis","edit_anonymous":"Przykro nam, ale musisz być zalogowany aby edytować ten wpis.","flag":"oflaguj ten wpis lub wyślij powiadomienie o nim do moderatorów","delete":"usuń ten wpis","undelete":"przywróc ten wpis","share":"udostępnij odnośnik do tego wpisu","more":"Więcej","delete_replies":{"confirm":{"one":"Czy chcesz usunąć również bezpośrednią odpowiedź na ten wpis?","few":"Czy chcesz usunąć również {{count}} bezpośrednie odpowiedzi na ten wpis?","other":"Czy chcesz usunąć również {{count}} bezpośrednich odpowiedzi na ten wpis?"},"yes_value":"Tak, usuń też odpowiedzi","no_value":"Nie, tylko ten wpis"},"admin":"administracja wpisem (tryb wiki itp)","wiki":"Przełącz wpis w tryb Wiki","unwiki":"Wyłącz tryb Wiki"},"actions":{"flag":"Oflaguj","defer_flags":{"one":"Odrocz flagę","few":"Odrocz flagi","other":"Odrocz flagi"},"it_too":{"off_topic":"Oflaguj też to","spam":"Oflaguj też to","inappropriate":"Oflaguj też to","custom_flag":"Oflaguj też to","bookmark":"Utwórz zakładkę","like":"Polub","vote":"Zagłosuj za tym"},"undo":{"off_topic":"Cofnij flagę","spam":"Cofnij flagę","inappropriate":"Cofnij flagę","bookmark":"Cofnij zakładkę","like":"Cofnij","vote":"Cofnij głos"},"people":{"off_topic":"{{icons}} oznaczyli jako nie-na-temat","spam":"{{icons}} oznaczyli jako spam","inappropriate":"{{icons}} oznaczyli jako niewłaściwe","notify_moderators":"{{icons}} powiadomiło moderatorów","notify_moderators_with_url":"{{icons}} \u003ca href='{{postUrl}}'\u003epowiadomiło moderatorów\u003c/a\u003e","notify_user":"{{icons}} wysłało prywatną wiadomość","notify_user_with_url":"{{icons}} wysłało \u003ca href='{{postUrl}}'\u003eprywatną wiadmość\u003c/a\u003e","bookmark":"{{icons}} dodało to do zakładek","like":"{{icons}} lubi to","vote":"{{icons}} zagłosowało za tym"},"by_you":{"off_topic":"Oznaczono jako nie-na-temat","spam":"Oflagowano jako spam","inappropriate":"Oznaczono jako niewłaściwe","notify_moderators":"Oflagowano do moderacji","notify_user":"Wysłałeś(-aś) prywatną wiadomość do użytkownika(-czki)","bookmark":"Dodano zakładkę w tym wpisie","like":"Lubisz ten wpis","vote":"Zagłosowano na ten wpis"},"by_you_and_others":{"off_topic":{"one":"Ty i 1 inna osoba oznaczyliście to jako nie-na-temat.","few":"Ty i {{count}} inne osoby oznaczyliście to jako nie-na-temat.","other":"Ty i {{count}} innych osób oznaczyliście to jako nie-na-temat."},"spam":{"one":"Ty i 1 inna osoba oflagowaliście to jako spam.","few":"Ty i {{count}} inne osoby oflagowaliście to jako spam.","other":"Ty i {{count}} innych osób oflagowaliście to jako spam."},"inappropriate":{"one":"Ty i 1 inna osoba oflagowaliście to jako niewłaściwe.","few":"Ty i {{count}} inne osoby oflagowaliście to jako niewłaściwe.","other":"Ty i {{count}} innych osób oflagowaliście to jako niewłaściwe."},"notify_moderators":{"one":"Ty i 1 inna osoba oflagowaliście to do moderacji.","few":"Ty i {{count}} inne osoby oflagowaliście to do moderacji.","other":"Ty i {{count}} innych osób oflagowaliście to do moderacji."},"notify_user":{"one":"Ty i 1 inna osoba wysłaliście prywatne wiadomości do tego użytkownika","few":"Ty i {{count}} inne osoby wysłaliście prywatne wiadomości do tego użytkownika","other":"Ty i {{count}} innych osób wysłaliście prywatne wiadomości do tego użytkownika"},"bookmark":{"one":"Ty i 1 inna osoba dodaliście ten wpis do zakładek.","few":"Ty i {{count}} inne osoby dodaliście ten wpis do zakładek.","other":"Ty i {{count}} innych osób dodaliście ten wpis do zakładek."},"like":{"one":"Ty i 1 inna osoba lubicie to.","few":"Ty i {{count}} inne osoby lubicie to.","other":"Ty i {{count}} innych osób lubicie to."},"vote":{"one":"Ty i 1 inna osoba zagłosowaliście za tym wpisem","few":"Ty i {{count}} inne osoby zagłosowaliście za tym wpisem","other":"Ty i {{count}} innych osób zagłosowaliście za tym wpisem"}},"by_others":{"off_topic":{"one":"1 osoba oflagowała to jako nie-na-temat","few":"{{count}} osoby oflagowały to jako nie-na-temat","other":"{{count}} osób oflagowało to jako nie-na-temat"},"spam":{"one":"1 osoba oflagowała to jako spam","few":"{{count}} osoby oflagowały to jako spam","other":"{{count}} osób oflagowało to jako spam"},"inappropriate":{"one":"1 osoba oflagowała to jako niewłaściwe","few":"{{count}} osoby oflagowały to jako niewłaściwe","other":"{{count}} osób oflagowało to jako niewłaściwe"},"notify_moderators":{"one":"1 osoba oflagowała to do moderacji","few":"{{count}} osoby oflagowały to do moderacji","other":"{{count}} osób oflagowało to do moderacji"},"notify_user":{"one":"1 osoba wysłała prywatną wiadomość do tego użytkownika","few":"{{count}} osoby wysłały prywatne wiadomości do tego użytkownika","other":"{{count}} osób wysłało prywatne wiadomości do tego użytkownika"},"bookmark":{"one":"1 osoba dodała ten wpis do zakładek","few":"{{count}} osoby dodały ten wpis do zakładek","other":"{{count}} osób dodało ten wpis do zakładek"},"like":{"one":"1 osoba lubi to","few":"{{count}} osoby lubią to","other":"{{count}} osób lubi to"},"vote":{"one":"1 osoba zagłosowała za tym wpisem","few":"{{count}} osoby zagłosowały za tym wpisem","other":"{{count}} osób zagłosowało za tym wpisem"}}},"edits":{"one":"1 edycja","other":"Liczba edycji: {{count}}","zero":"brak edycji"},"delete":{"confirm":{"one":"Jesteś pewny(-a), że chcesz usunąć ten wpis?","few":"Jesteś pewny(-a), że chcesz usunąć te wszystkie wpisy?","other":"Czy na pewno chcesz usunąć te wszystkie wpisy?"}},"revisions":{"controls":{"first":"Pierwsza wersja","previous":"Poprzednia wersja","next":"Następna wersja","last":"Ostatnia wersja","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e vs \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Pokaż opublikowaną wersję wraz z elementami dodanymi i usuniętymi w treści.","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Pokaż wersje opublikowane do porównania obok siebie.","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Pokaż porównanie źródła markdown obok siebie","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Markdown"}},"details":{"edited_by":"Edytowane przez"}}},"category":{"can":"może\u0026hellip; ","none":"(brak kategorii)","choose":"Wybierz kategorię\u0026hellip;","edit":"edytuj","edit_long":"Edytuj","view":"Pokaż Tematy w Kategorii","general":"Ogólne","settings":"Ustawienia","delete":"Usuń kategorię","create":"Utwórz kategorię","save":"Zapisz kategorię","creation_error":"Podczas tworzenia tej kategorii wystąpił błąd.","save_error":"Podczas zapisywania tej kategorii wystąpił błąd.","name":"Nazwa kategorii","description":"Opis","topic":"temat kategorii","logo":"Grafika z logo kategorii","background_image":"Grafika z tłem kategorii","badge_colors":"Kolor Etykiety","background_color":"Kolor tła","foreground_color":"Kolor Pierwszego Planu","name_placeholder":"Maksymalnie jedno lub dwa słowa","color_placeholder":"Dowolny kolor sieciowy","delete_confirm":"Czy na pewno chcesz usunąć tę kategorię?","delete_error":"Podczas próby usunięcia tej kategorii wystąpił błąd.","list":"Pokaż kategorie","no_description":"Proszę dodaj opis do tej kategorii.","change_in_category_topic":"Edytuj opis","already_used":"Ten kolor jest używany przez inną kategorię","security":"Bezpieczeństwo","images":"Obrazy","auto_close_label":"Automatycznie zamykaj tematy po:","auto_close_units":"godzin","email_in":"Niestandardowy adres poczty przychodządej","email_in_allow_strangers":"Akceptuj wiadomości email od anonimowych, nieposiadających kont użytkowników ","email_in_disabled":"Tworzenie nowych tematów emailem jest wyłączone w ustawieniach serwisu. ","email_in_disabled_click":"Kliknij tu, aby włączyć.","allow_badges_label":"Włącz przyznawanie odznak na podstawie aktywności w tej kategorii","edit_permissions":"Edytuj uprawnienia","add_permission":"Dodaj uprawnienie","this_year":"ten rok","position":"pozycja","default_position":"Domyślna pozycja","position_disabled_click":"włącz statyczną kolejność kategorii","parent":"Kategoria rodzica","notifications":{"watching":{"title":"Obserwuj wszystko","description":"Będziesz automatycznie śledzić wszystkie nowe tematy w tych kategoriach: liczba nieprzeczytanych i nowych wpisów będzie wyświetlana obok tytułów na liście tematów. Dodatkowo będziesz otrzymywać powiadomienie o każdym nowym wpisie i temacie."},"tracking":{"title":"Śledzona","description":"Będziesz automatycznie śledzić wszystkie tematy w tych kategoriach: licznik nowych i nieprzeczytanych wpisów pojawi się obok ich tytułów na liście tematów."},"regular":{"title":"Normalny","description":"Dostaniesz powiadomienie jedynie gdy ktoś wspomni twoją @nazwę lub odpowie na twój wpis."},"muted":{"title":"Wyciszone","description":"Nie będziesz powiadamiany o nowych tematach w tych kategoriach i nie będą się one pojawiać w karcie Nieprzeczytane."}}},"flagging":{"title":"Dlaczego chcesz oflagować ten wpis?","action":"Oflaguj wpis","take_action":"Podejmij działanie","notify_action":"Prywatna wiadomość","delete_spammer":"Usuń spamera","delete_confirm":"Zamierzasz usunąć\u003cb\u003e%{posts}\u003c/b\u003e wpisów i \u003cb\u003e%{topics}\u003c/b\u003e tematów użytkownika, usunąć jest konto, zablokować możliwość zakładania kont z jego adresu IP \u003cb\u003e%{ip_address}\u003c/b\u003e i dodać jego email \u003cb\u003e%{email}\u003c/b\u003e do listy trwale zablokowanych. Czy na pewno ten użytkownik jest spamerem?","yes_delete_spammer":"Tak, usuń spamera","submit_tooltip":"Zapisz prywatną flagę.","take_action_tooltip":"Nie czekaj, aż wpis zostanie zgłoszony przez innych,  natychmiast oflaguj do działania . ","cant":"Przepraszamy, nie możesz oflagować teraz tego wpisu.","custom_placeholder_notify_user":"Dlaczego ten wpis wymaga bezpośredniej, prywatnej rozmowy z tym użytkownikiem? Napisz konkretnie, konstuktywnie i kulturalnie.","custom_placeholder_notify_moderators":"Dlaczego ten wpis wymaga uwagi moderatora? Daj nam znać co konkretnie Cię zaniepokoiło i dostarcz nam odpowiednie odnośniki jeśli to możliwe.","custom_message":{"at_least":"wprowadź co najmniej {{n}} znaków","more":"{{n}} aby wysłać…","left":"{{n}} pozostało"}},"flagging_topic":{"title":"Dlaczego chcesz zgłosić ten temat?","action":"Zgłoś temat","notify_action":"Wyślij prywatną wiadomość"},"topic_map":{"title":"Podsumowanie tematu","links_shown":"pokaż wszystkie {{totalLinks}} odnośników…","clicks":{"one":"1 kliknięcie","few":"%{count} kliknięć","other":"%{count} kliknięć"}},"topic_statuses":{"locked":{"help":"Temat został zamknięty. Dodawanie nowych odpowiedzi nie jest możliwe."},"unpinned":{"title":"Nieprzypięty","help":"Temat nie jest przypięty. Będzie wyświetlany w normalnej kolejności"},"pinned_globally":{"title":"Przypięty globalnie","help":"Temat przypięty globalnie. Będzie wyświetlany na początku wszystkich list"},"pinned":{"title":"Przypięty","help":"Temat przypięty. Będzie wyświetlany na początku swojej kategorii"},"archived":{"help":"Ten temat jest zarchiwizowany; jest zamrożony i nie można go zmieniać"},"invisible":{"help":"Temat jest niewidoczny: nie będzie wyświetlany na listach tematów i można uzyskać do niego dostęp jedynie poprzez link bezpośredni"}},"posts":"Wpisy","posts_lowercase":"wpisy","posts_long":"jest {{number}} wpisów w tym temacie","original_post":"Oryginalny wpis","views":"Wyświetlenia","views_lowercase":"wyświetlenia","replies":"Odpowiedzi","views_long":"ten temat był oglądany {number}} razy","activity":"Aktywność","likes":"Polubienia","likes_lowercase":"polubienia","likes_long":"jest {{number}} polubień w tym temacie","users":"Użytkownicy","users_lowercase":"użytkownicy","category_title":"Kategoria","history":"Historia","changed_by":"przez {{author}}","categories_list":"Lista Kategorii","filters":{"with_topics":"%{filter} tematy","with_category":"%{filter} tematy w %{category} ","latest":{"title":"Ostatnie","help":"tematy z ostatnimi wpisami"},"hot":{"title":"Gorące","help":"wybrane najbardziej gorące tematy"},"starred":{"title":"Oznaczone","help":"twoje oznaczone tematy"},"read":{"title":"Przeczytane","help":"tematy które przeczytałeś, w kolejności od ostatnio przeczytanych"},"categories":{"title":"Kategorie","title_in":"Kategoria - {{categoryName}}","help":"wszystkie tematy zgrupowane przez kategorię"},"unread":{"title":{"zero":"Nieprzeczytane","one":"Nieprzeczytany (1)","other":"Nieprzeczytanych ({{count}})"},"help":"obserwowane lub śledzone tematy z nieprzeczytanymi wpisami","lower_title_with_count":{"one":"1 nieprzeczytany","other":"{{count}} nieprzeczytanych"}},"new":{"lower_title_with_count":{"one":"1 nowy","other":"{{count}} nowych"},"lower_title":"nowe","title":{"zero":"Nowe","one":"Nowy (1)","other":"Nowych ({{count}})"},"help":"tematy dodane w ciągu ostatnich kilku dni"},"posted":{"title":"Moje wpisy","help":"tematy w których pisałeś"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"najnowsze tematy w kategorii {{categoryName}}"},"top":{"title":"Popularne","help":"popularne tematy w ubiegłym roku, miesiącu, tygodniu lub dniu","yearly":{"title":"Popularne w tym roku"},"monthly":{"title":"Popularne w tym miesiącu"},"weekly":{"title":"Popularne w tym tygodniu"},"daily":{"title":"Popularne dzisiaj"},"this_year":"W tym roku","this_month":"W tym miesiącu","this_week":"W tym tygodniu","today":"Dzisiaj","other_periods":"zobacz więcej popularnych tematów"}},"permission_types":{"full":"tworzyć / odpowiadać / przeglądać","create_post":"odpowiadać / przeglądać","readonly":"przeglądać"},"type_to_filter":"pisz, aby filtrować…","admin":{"title":"Administrator Discourse","moderator":"Moderator","dashboard":{"title":"Kokpit","last_updated":"Ostatnia aktualizacja panelu kontrolnego:","version":"Wersja","up_to_date":"Wersja Aktualna!","critical_available":"Ważna aktualizacja jest dostępnae.","updates_available":"Aktualizacje są dostępne.","please_upgrade":"Proszę zaktualizuj!","no_check_performed":"Sprawdzanie dostępności aktualizacji nie jest wykonywane. Sprawdź działa czy sidekiq.","stale_data":"Sprawdzanie dostępności aktualizacji nie było ostatnio wykonywane. Sprawdź działa czy sidekiq.","version_check_pending":"Wygląda na to że ostatnio była wykonana aktualizacja. Fantastycznie!","installed_version":"Zainstalowana","latest_version":"Najnowsza","problems_found":"Wykryto pewne problemy w Twojej instalacji Discourse:","last_checked":"Ostatnio sprawdzana","refresh_problems":"Odśwież","no_problems":"Nie znaleziono problemów.","moderators":"Moderatorzy:","admins":"Adminstratorzy:","blocked":"Zablokowani:","suspended":"Zawieszeni:","private_messages_short":"PM","private_messages_title":"Prywatne Wiadomości","reports":{"today":"Dzisiaj","yesterday":"Wczoraj","last_7_days":"Ostatnie 7 dni","last_30_days":"Ostatnie 30 dni","all_time":"Przez cały czas","7_days_ago":"7 dni temu","30_days_ago":"30 dni temu","all":"Wszystkie","view_table":"Pokaż jako Tabelę","view_chart":"Pokaż jako wykres słupkowy"}},"commits":{"latest_changes":"Ostatnie zmiany: proszę aktualizuj często!","by":"przez"},"flags":{"title":"Flagi","old":"Stare","active":"Aktywność","agree":"Potwierdź","agree_title":"Potwierdź to zgłoszenie jako uzasadnione i poprawne","agree_flag_modal_title":"Potwierdź i...","agree_flag_hide_post":"Potwierdź (ukryj post i wyślij PW)","agree_flag_hide_post_title":"Ukryj ten wpis i automatycznie wyślij użytkownikowi prywatną wiadomość informującą, że wpis wymaga przeredagowania","agree_flag":"Potwierdź flagę","agree_flag_title":"Potwierdź flagę i zostaw wpis bez zmian","defer_flag":"Zignoruj","defer_flag_title":"Usunięcie flagi, nie wymaga dalszych działań.","delete":"Usuń","delete_title":"Usuń wpis do którego odnosi się flaga.","delete_post_defer_flag":"Usuń wpis i zignoruj flagę","delete_post_defer_flag_title":"Usuń wpis. Jeśli jest pierwszym w temacie, usuń temat.","delete_post_agree_flag":"Usuń post i potwierdź flagę","delete_post_agree_flag_title":"Usuń wpis. Jeśli jest pierwszym w temacie, usuń temat.","delete_flag_modal_title":"Usuń i...","delete_spammer":"Usuń spamera","delete_spammer_title":"Usuwa konto tego użytkownika oraz wszystkie tematy i wpisy jakie nim utworzono.","disagree_flag_unhide_post":"Wycofaj (pokaż wpis)","disagree_flag_unhide_post_title":"Usuń wszystkie flagi z tego wpisu i uczyń go widocznym ponownie.","disagree_flag":"Wycofaj","disagree_flag_title":"Wycofaj nieuzasadnioną flagę.","clear_topic_flags":"Zrobione","clear_topic_flags_title":"Ten temat został sprawdzony i związane z nim problemy zostały rozwiązane. Kliknij Zrobione, aby usunąć flagi.","more":"(więcej odpowiedzi…)","dispositions":{"agreed":"potwierdzono","disagreed":"wycofano","deferred":"zignorowano"},"flagged_by":"Oflagowano przez","resolved_by":"Rozwiązano przez","took_action":"Podjęto działanie","system":"System","error":"Coś poszło nie tak","reply_message":"Odpowiedz","no_results":"Nie ma flag.","topic_flagged":"Ten \u003cstrong\u003etemat\u003c/strong\u003e został oflagowany.","visit_topic":"Odwiedź temat by podjąć działania.","was_edited":"Wpis został zmieniony po pierwszej fladze","summary":{"action_type_3":{"one":"nie-na-temat","few":"nie-na-temat x{{count}}","other":"nie-na-temat x{{count}}"},"action_type_4":{"one":"nieodpowiednie","few":"nieodpowiednie x{{count}}","other":"nieodpowiednie x{{count}}"},"action_type_6":{"one":"niestandardowy","few":"niestandardowe x{{count}}","other":"niestandardowych x{{count}}"},"action_type_7":{"one":"niestandardowy","few":"niestandardowe x{{count}}","other":"niestandardowych x{{count}} "},"action_type_8":{"one":"spam","few":"spam x{{count}}","other":"spam x{{count}}"}}},"groups":{"primary":"Główna grupa","no_primary":"(brak podstawowej grupy)","title":"Grupy","edit":"Edytuj grupy","refresh":"Odśwież","new":"Nowa","selector_placeholder":"dodaj użytkowników","name_placeholder":"Nazwa Grupy, bez spacji, takie same zasady jak przy nazwie użytkownika","about":"Tu możesz edytować przypisania do grup oraz ich nazwy","group_members":"Członkowie grupy","delete":"Usuń","delete_confirm":"Usunąć tę grupę?","delete_failed":"Nie można usunąć grupy. Jeżeli jest to grupa automatyczna, nie może zostać zniszczona."},"api":{"generate_master":"Generuj Master API Key","none":"Nie ma teraz aktywnych kluczy API.","user":"Urzytkownik","title":"API","key":"Klucz API","generate":"Generuj","regenerate":"Odnów","revoke":"Unieważnij","confirm_regen":"Czy na pewno chcesz zastąpić ten API Key nowym?","confirm_revoke":"Czy na pewno chcesz unieważnić ten klucz?","info_html":"Twoje klucze API dają dostęp do tworzenia i aktualizowania tenatów przez wywołania JSON.","all_users":"Wszyscy użytkownicy"},"backups":{"title":"Kopie zapasowe","menu":{"backups":"Kopie zapasowe","logs":"Logi"},"none":"Brak kopii zapasowych.","read_only":{"enable":{"title":"Włącz tryb tylko do odczytu","text":"Włącz tryb tylko do odczytu","confirm":"Czy na pewno chcesz włączyć tryb tylko do odczytu?"},"disable":{"title":"Wyłącz tryb tylko do odczytu","text":"Wyłącz tryb tylko do odczytu"}},"logs":{"none":"Póki co brak logów…"},"columns":{"filename":"Nazwa pliku","size":"Rozmiar"},"upload":{"text":"PRZEŚLIJ","uploading":"PRZESYŁANIE","success":"'{{filename}}' został pomyślnie przesłany.","error":"Podczas przesyłania pliku wystąpił błąd '{{filename}}': {{message}}"},"operations":{"is_running":"Proces jest w trakcie działania…","failed":"Proces {{operation}} zakończył się niepowodzeniem. Sprawdź logi.","cancel":{"text":"Anuluj","title":"Anuluj bieżącą operację","confirm":"Czy na pewno chcesz anulować bieżącą operację?"},"backup":{"text":"Kopia zapasowa","title":"Wykonaj kopię zapasową","confirm":"Czy chcesz wykonać kopię zapasową?","without_uploads":"Tak (bez wysyłania)"},"download":{"text":"Pobierz","title":"Pobierz kopię zapasową"},"destroy":{"text":"Usuń","title":"Usuń kopię zapasową","confirm":"Czy na pewno chcesz zniszczyć tą kopię zapasową?"},"restore":{"is_disabled":"Przywracanie jest zablokowane w ustawieniach.","text":"Przywróć","title":"Przywróć kopię zapasową","confirm":"Czy na pewno chcesz przywrócić tą kopię zapasową?"},"rollback":{"text":"Wycofaj","title":"Wycofaj bazę danych do poprzedniego poprawnego stanu","confirm":"Czy na pewno chcesz przywrócić bazę danych do poprzedniego poprawnego stanu?"}}},"export_csv":{"users":{"text":"Eksport użytkowników","title":"Wyeksportuj listę użytkowników do pliku CSV"},"success":"Rozpoczęto eksport, za jakiś czas otrzymasz powiadomienie z informacją o postępach.","failed":"Eksport zakończył się niepowodzeniem. Sprawdź logi."},"customize":{"title":"Wygląd","long_title":"Personalizacja strony","header":"Nagłówki","css":"Arkusz stylów","mobile_header":"Mobilne nagłówki","mobile_css":"Mobilny arkusz stylów","override_default":"Nie dołączaj standardowego arkusza stylów","enabled":"Włączone?","preview":"podgląd","undo_preview":"usuń podgląd","rescue_preview":" domyślny styl","explain_preview":"Podejrzyj witrynę z użyciem tego sylesheet'u","explain_undo_preview":"Wróć do aktualnie aktywnego schematu styli","explain_rescue_preview":"Zobacz stronę z domyślnym stylem","save":"Zapisz","new":"Nowy","new_style":"Nowy styl","delete":"Usuń","delete_confirm":"Usunąć tę personalizację?","about":"Zmień arkusze stylów CSS i nagłówki HTML w witrynie. Dodaj własne ustawienie aby rozpocząć.","color":"Kolor","opacity":"Widoczność","copy":"Kopiuj","css_html":{"title":"CSS, HTML","long_title":"Personalizacja kodu CSS i HTML"},"colors":{"title":"Kolory","long_title":"Schematy kolorów","about":"Zmień kolory strony bez modyfikacji CSS. Dodaj nowy schemat kolorów, aby rozpocząć.","new_name":"Nowy schemat kolorów","copy_name_prefix":"Kopia","delete_confirm":"Usunąć ten schemat kolorów?","undo":"cofnij","undo_title":"Cofnij zmiany tego koloru od ostatniego zapisu","revert":"przywróć","revert_title":"Zresetuj  ten kolor do wartości domyślnej.","primary":{"name":"podstawowy","description":"Większość tekstu, ikon oraz krawędzi."},"secondary":{"name":"drugorzędny","description":"Główny kolor tła oraz kolor tekstu niektórych przycisków."},"tertiary":{"name":"trzeciorzędny","description":"Linki, niektóre przyciski, powiadomienia oraz kolor używany w różnych akcentach."},"quaternary":{"name":"czwartorzędny","description":"Nawigacja"},"header_background":{"name":"tło nagłówka","description":"Kolor tła nagłówka witryny."},"header_primary":{"name":"podstawowy nagłówka","description":"Tekst oraz ikony w nagłówku witryny."},"highlight":{"name":"zaznacz","description":"Kolor tła podświetlonych/zaznaczonych elementów na stronie, takich jak wpisy i tematy."},"danger":{"name":"niebezpieczeństwo","description":"Kolor podświetlenia dla akcji takich jak usuwanie wpisów i tematów."},"success":{"name":"sukces","description":"Używany do oznaczania operacji zakończonych sukcesem."},"love":{"name":"polubienie","description":"Kolor przycisku polub"}}},"email":{"title":"Email","settings":"Ustawienia","all":"Wszystkie","sending_test":"Wysyłanie testowego emaila…","test_error":"Wystąpił problem podczas wysyłania testowego maila. Sprawdź ustawienia poczty, sprawdź czy Twój serwer nie blokuje połączeń pocztowych i spróbuj ponownie.","sent":"Wysłane","skipped":"Pominięte","sent_at":"Wysłany na","time":"Czas","user":"Użytkownik","email_type":"Typ emaila","to_address":"Na adres","test_email_address":"adres email do testu","send_test":"Wyślij email testowy","sent_test":"wysłany!","delivery_method":"Metoda Dostarczenia","preview_digest":"Pokaż zestawienie aktywności","preview_digest_desc":"Narzędzie służące do podglądu treści emaila z zestawieniem aktywności jaki jest wysyłany z twojego forum.","refresh":"Odśwież","format":"Format","html":"html","text":"text","last_seen_user":"Ostatnia ","reply_key":"Klucz odpowiedzi","skipped_reason":"Powód pominięcia","logs":{"none":"Nie znaleziono logów.","filters":{"title":"Filtr","user_placeholder":"nazwa użytkownika","address_placeholder":"nazwa@example.com","type_placeholder":"streszczenie, rejestracja…","skipped_reason_placeholder":"powód"}}},"logs":{"title":"Logi","action":"Działanie","created_at":"Utworzony","last_match_at":"Ostatnia Zgodność","match_count":"Zgodność","ip_address":"IP","delete":"Usuń","edit":"Edytuj","save":"Zapisz","screened_actions":{"block":"blok","do_nothing":"nic nie rób"},"staff_actions":{"title":"Działania obsługi","instructions":"Kliknij na użytkowniku lub akcji aby wyfiltrować listę. Kliknij awatar aby przejść na stronę użytkownika.","clear_filters":"Pokaż wszystko","staff_user":"Użytkownik obsługi","target_user":"Użytkownik będący Obiektem","subject":"Temat","when":"Kiedy","context":"Kontekst","details":"Szczegóły","previous_value":"Poprzedni","new_value":"Nowy","diff":"Różnice","show":"Pokaż","modal_title":"Szczegóły","no_previous":"Nie ma wcześniejszej wartości.","deleted":"Nie ma nowej wartości. Zapis został usunięty.","actions":{"delete_user":"usuń użytkownika","change_trust_level":"zmień poziom zaufania","change_site_setting":"zmień ustawienia strony","change_site_customization":"zmień dostosowania strony","delete_site_customization":"usuń personalizację strony","suspend_user":"zawieś użytkownika","unsuspend_user":"odwieś użytkownika","grant_badge":"przyznaj odznakę","revoke_badge":"odbierz odznakę"}},"screened_emails":{"title":"Ekranowane emaile","description":"Kiedy ktoś próbuje założyć nowe konto, jego adres email zostaje sprawdzony i rejestracja zostaje zablokowana, lub inna akcja jest podejmowana.","email":"Adres email","actions":{"allow":"Zezwalaj"}},"screened_urls":{"title":"Ekranowane URLe","description":"URLe wypisane tutaj były używane we wpisach przez użytkowników wykrytych jako spamerzy.","url":"URL","domain":"Domena"},"screened_ips":{"title":"Ekranowane adresy IP","description":"Adres IP który teraz oglądasz. Użyj \"Zezwól\" aby dodać do białej listy adresów IP.","delete_confirm":"Czy na pewno chcesz usunąć regułę dla %{ip_address}?","actions":{"block":"Zablokuj","do_nothing":"Zezwól"},"form":{"label":"Nowy:","ip_address":"Adres IP","add":"Dodaj"}},"logster":{"title":"Logi błędów"}},"impersonate":{"title":"Zaloguj się na to konto","help":"Użyj tego narzędzia, aby logować się jako dowolny użytkownik w celach diagnozy problemów."},"users":{"title":"Użytkownicy","create":"Dodaj Administratora","last_emailed":"Ostatnio wysłano email","not_found":"Przepraszamu, taka nazwa użytkowanika nie istnieje w naszym systemie.","active":"Aktywny","nav":{"new":"Nowy","active":"Aktywny","pending":"Oczekujący","admins":"Administratorzy","moderators":"Moderatorzy","suspended":"Zawieszeni","blocked":"Zablokowani"},"approved":"Zatwierdzam?","approved_selected":{"one":"zatwierdź użytkownika","few":"zatwierdź użytkowników ({{count}})","other":"zatwierdź użytkowników ({{count}})"},"reject_selected":{"one":"odrzuć użytkownika(-czkę)","few":"odrzuć użytkowników ({{count}})","other":"odrzuć użytkowników ({{count}})"},"titles":{"active":"Aktywni użytkownicy","new":"Nowi Użytkownicy","pending":"Użytkownicy Oczekujący na Przegląd","newuser":"Użytkownicy na 0 poziomie zaufania (Nowi)","basic":"Użytkownicy na 1 poziomie zaufania (Podstawowi)","regular":"Użytkownicy na 2 poziomie zaufania (Zwyczajni)","elder":"Użytkownicy na 4 poziomie zaufania (Starszyzna)","admins":"Administratorzy","moderators":"Moderatoratorzy","blocked":"Zablokowani Użytkownicy","suspended":"Zawieszeni Użytkownicy"},"reject_successful":{"one":"Odrzucenie 1 użytkownika(-czki) powiodło się.","few":"Odrzucenie %{count} użytkowników powiodło się.","other":"Odrzucenie %{count} użytkowników powiodło się."},"reject_failures":{"one":"Odrzucenie 1 użytkownika(-czki) nie powiodło się.","few":"Odrzucenie %{count} użytkowników powiodło się.","other":"Odrzucenie %{count} użytkowników nie powiodło się."}},"user":{"suspend_failed":"Coś poszło nie tak podczas zawieszania użytkownika {{error}}","unsuspend_failed":"Coś poszło nie tak podczas odwieszania użytkownika {{error}}","suspend_duration":"Jak długo użytkownik ma być zawieszony?","suspend_duration_units":"(dni)","suspend_reason_label":"Dlaczego zawieszasz? Ten tekst \u003cb\u003ebędzie widoczny dla wszystkich\u003c/b\u003e na stronie profilu użytkownika i będzie wyświetlany użytkownikowi gdy ten będzie próbował się zalogować. Zachowaj zwięzłość.","suspend_reason":"Powód","suspended_by":"Zawieszony przez","delete_all_posts":"Usuń wszystkie wpisy","delete_all_posts_confirm":"Zamierzasz usunąć %{posts} wpisów i %{topics} tematów. Czy na pewno?","suspend":"Zawieś","unsuspend":"Odwieś","suspended":"Zawieszony?","moderator":"Moderator?","admin":"Admin?","blocked":"Zablokowany?","show_admin_profile":"Admin","edit_title":"Edytuj tytuł","save_title":"Zapisz tytuł","refresh_browsers":"Wymuś odświeżenie przeglądarki","refresh_browsers_message":"Wiadomość wysłana do wszystkich klientów!","show_public_profile":"Pokaż profil publiczny","impersonate":"Podszyj się","ip_lookup":"Wyszukiwanie IP","log_out":"Wyloguj","logged_out":"Użytkownik został wylogowany na wszystkich urządzeniach.","revoke_admin":"Odbierz status admina","grant_admin":"Przyznaj status admina","revoke_moderation":"Odbierz status moderatora","grant_moderation":"Przyznaj status moderatora","unblock":"Odblokuj","block":"Blokuj","reputation":"Reputacja","permissions":"Uprawnienia","activity":"Aktywność","like_count":"Polubień danych / otrzymanych","last_100_days":"w ostatnich 100 dniach","private_topics_count":"Prywatne tematy","posts_read_count":"Przeczytane wpisy","post_count":"Napisane wpisy","topics_entered":"Widziane tematy","flags_given_count":"Dane flagi","flags_received_count":"Otrzymane flagi","flags_given_received_count":"Flagi przyznane / otrzymane","approve":"Zatwierdź","approved_by":"zatwierdzone przez","approve_success":"Użytkownik zatwierdzony i został wysłany email z instrukcjami aktywacji.","approve_bulk_success":"Sukces! Wszyscy wybrani użytkownicy zostali zatwierdzeni i powiadomieni.","time_read":"Czas czytania","delete":"Usuń użytkownika","delete_forbidden_because_staff":"Admini i moderatorzy nie mogą zostać usunięci.","delete_forbidden":{"one":"Użytkownik nie może zostać usunięty jeśli posiada wpisy. Usuń wszystkie jego wpisy przed usunięciem użytkownika. (Nie można usunąć wpisów starszych niż %{count} dzień.)","few":"Użytkownik nie może zostać usunięty jeśli posiada wpisy. Usuń wszystkie jego wpisy przed usunięciem użytkownika. (Nie można usunąć wpisów starszych niż %{count} dni.)","other":"Użytkownik nie może zostać usunięty jeśli posiada wpisy. Usuń wszystkie jego wpisy przed usunięciem użytkownika. (Nie można usunąć wpisów starszych niż %{count} dni.)"},"cant_delete_all_posts":{"one":"Nie można usunąć wszystkich postów. Część z nich ma więcej niż 1 dzień. (Ustawienie delete_user_max_post_age)","few":"Nie można usunąć wszystkich postów. Część z nich ma więcej niż %{count} dni. (Ustawienie delete_user_max_post_age)","other":"Nie można usunąć wszystkich wpisów. Część z nich ma więcej niż %{count} dni. (Ustawienie delete_user_max_post_age.)"},"cant_delete_all_too_many_posts":{"one":"Nie można usunąć wszystkich postów, ponieważ użytkownik ma więcej niż 1 post. (delete_all_posts_max)","few":"Nie można usunąć wszystkich postów, ponieważ użytkownik ma ich więcej niż %{count}. (delete_all_posts_max)","other":"Nie można usunąć wszystkich wpisów, ponieważ użytkownik ma ich więcej niż %{count}. (delete_all_posts_max)"},"delete_confirm":"Czy NA PEWNO chcesz usunąć tego użytkownika? Będzie to nieodwracalne!","delete_and_block":"Usuń i \u003cb\u003ezablokuj\u003c/b\u003e ten email oraz adres IP","deleted":"Użytkownik został usunięty.","delete_failed":"Wystąpił błąd podczas usuwania użytkownika. Upewnij się, że wszystkie wpisy zostały usunięte przed przystąpieniem do usuwania użytkownika.","send_activation_email":"Wyślij email aktywacyjny","activation_email_sent":"Email Aktywacyjny został wysłany.","send_activation_email_failed":"Wystąpił problem podczas wysyłania jeszcze jednego emaila aktywacyjnego. %{error}","activate":"Aktywuj Konto","activate_failed":"Wystąpił problem przy aktywacji konta użytkownika.","deactivate_account":"Deaktywuj konto","deactivate_failed":"Wystąpił problem przy deaktywacji konta użytkownika.","unblock_failed":"Wystąpił problem podczaj odblokowania użytkownika.","block_failed":"Wystąpił problem podczas blokowania użytkownika.","deactivate_explanation":"Deakrywowany użytkownik musi ponownie potwierdzić swój adres email.","suspended_explanation":"Zawieszony użytkownkik nie może sie logować.","block_explanation":"Zablokowany użytkownik nie może tworzyć wpisów ani zaczynać tematów.","trust_level_change_failed":"Wystąpił problem przy zmianie poziomu zaufania użytkowanika.","suspend_modal_title":"Zawieś użytkownika","trust_level_2_users":"Użytkownicy o 2. poziomie zaufania","trust_level_3_requirements":"Wymagania 3. poziomu zaufania","tl3_requirements":{"title":"Wymagania dla osiągnięcia 3. poziomu zaufania","table_title":"W ciągu ostatnich 100 dni:","value_heading":"Wartość","requirement_heading":"Wymaganie","visits":"Odwiedziny","days":"dni","topics_replied_to":"Tematy w odpowiedzi do","topics_viewed":"Wyświetlone Tematy","topics_viewed_all_time":"Oglądane Tematy (cały czas)","posts_read":"Przeczytane Wpisy","posts_read_all_time":"Przeczytane Wpisy (cały czas)","flagged_posts":"Zgłoszonych wpisów","flagged_by_users":"Flagujący Użytkownicy ","likes_given":"Polubień danych","likes_received":"Polubień otrzymanych"},"sso":{"title":"Single Sign On","external_id":"Zewnętrzny ID","external_username":"Nazwa użytkownika","external_name":"Nazwa","external_email":"Email","external_avatar_url":"URL awatara"}},"site_content":{"none":"Wybierz typ zawartości których chcesz zacząć edytować.","title":"Teksty","edit":"Edytuj zawartość strony"},"site_settings":{"show_overriden":"Pokaż tylko nadpisane","title":"Ustawienia","reset":"przywróć domyślne","none":"żadne","no_results":"Brak wyników wyszukiwania","clear_filter":"Wyczyść","categories":{"all_results":"Wszystkie","required":"Wymagane","basic":"Podstawowe","users":"Użytkownicy","posting":"Pisanie","email":"Email","files":"Pliki","trust":"Poziomy zaufania","security":"Bezpieczeństwo","onebox":"Onebox","seo":"SEO","spam":"Spam","rate_limits":"Limity","developer":"Deweloperskie","embedding":"Osadzanie","legal":"Prawne","uncategorized":"Inne","backups":"Kopie zapasowe","login":"Logowanie"}},"badges":{"title":"Odznaki","new_badge":"Nowa odznaka","new":"Nowa","name":"Nazwa","badge":"Odznaka","display_name":"Wyświetlana nazwa","description":"Opis","badge_type":"Typ odznaki","badge_grouping":"Grupa","badge_groupings":{"modal_title":"Grupy odznak"},"granted_by":"Przyznana przez","granted_at":"Przyznana","save":"Zapisz","delete":"Usuń","delete_confirm":"Czy na pewno chcesz usunąć tę odznakę?","revoke":"Odbierz","revoke_confirm":"Czy na pewno chcesz odebrać tę odznakę?","edit_badges":"Edytuj odznaki","grant_badge":"Przyznaj odznakę","granted_badges":"Przyznane odznaki","grant":"Przyznaj","no_user_badges":"%{name} nie otrzymał żadnych odznak.","no_badges":"Nie ma odznak, które można by było przyznać.","allow_title":"Pozwól wykorzystywać odznakę jako tytuł","multiple_grant":"Może być przyznana wielokrotnie","listable":"Wyświetlaj odznakę na publicznych listach odznak","enabled":"Włącz odznakę","icon":"Ikona","query":"Zapytanie odznaki (SQL) ","preview":{"bad_count_warning":{"header":"UWAGA!"},"sample":"Podgląd:","grant":{"with":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e","with_post":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e za wpis w %{link}","with_post_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e za wpis w %{link} o \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e","with_time":"\u003cspan class=\"username\"\u003e%{username}\u003c/span\u003e o \u003cspan class=\"time\"\u003e%{time}\u003c/span\u003e"}}}},"lightbox":{"download":"pobierz"},"keyboard_shortcuts_help":{"title":"Skróty klawiszowe","jump_to":{"title":"Skocz do","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e strona główna (Ostatnie)","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e Ostatnie","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e Nowe","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e Nieprzeczytane","starred":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ef\u003c/b\u003e Ulubione","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e Kategorie"},"navigation":{"title":"Nawigacja","jump":"\u003cb\u003e#\u003c/b\u003e idź do wpisu o numerze","back":"\u003cb\u003eu\u003c/b\u003e wstecz","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e przesuń zaznaczenie w górę/dół","open":"\u003cb\u003eo\u003c/b\u003e lub \u003cb\u003eEnter\u003c/b\u003e otwórz wybrany temat","next_prev":"\u003cb\u003eshift j\u003c/b\u003e/\u003cb\u003eshift k\u003c/b\u003e następna/poprzednia sekcja"},"application":{"title":"Aplikacja","create":"\u003cb\u003ec\u003c/b\u003e utwórz nowy temat","notifications":"\u003cb\u003en\u003c/b\u003e pokaż powiadomienia","site_map_menu":"\u003cb\u003e=\u003c/b\u003e otwórz menu mapy strony","user_profile_menu":"\u003cb\u003ep\u003c/b\u003e Otwórz menu profilu użytkownika","show_incoming_updated_topics":"\u003cb\u003e.\u003c/b\u003e pokaż nowe/zmienione tematy","search":"\u003cb\u003e/\u003c/b\u003e wyszukaj","help":"\u003cb\u003e?\u003c/b\u003e pokaż skróty klawiszowe","dismiss_new_posts":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e wyczyść listę wpisów","dismiss_topics":"\u003cb\u003ex\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e wyczyść listę tematów"},"actions":{"title":"Operacje","star":"\u003cb\u003ef\u003c/b\u003e oznacz temat gwiazdką","share_topic":"\u003cb\u003eshift s\u003c/b\u003e udostępnij temat","share_post":"\u003cb\u003es\u003c/b\u003e udostępnij wpis","reply_as_new_topic":"\u003cb\u003et\u003c/b\u003e odpowiedz w nowym temacie","reply_topic":"\u003cb\u003eshift r\u003c/b\u003e odpowiedz w temacie","reply_post":"\u003cb\u003er\u003c/b\u003e odpowiedz na wpis","quote_post":"\u003cb\u003eq\u003c/b\u003e cytuj wpis","like":"\u003cb\u003el\u003c/b\u003e polub wpis","flag":"\u003cb\u003e!\u003c/b\u003e oflaguj wpis","bookmark":"\u003cb\u003eb\u003c/b\u003e ustaw zakładkę na wpisie","edit":"\u003cb\u003ee\u003c/b\u003e edytuj wpis","delete":"\u003cb\u003ed\u003c/b\u003e usuń wpis","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e ucisz temat","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e zwykły (domyślny) temat","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e śledź temat","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e śledź wszystko w temacie"}},"badges":{"title":"Odznaki","allow_title":"użycie odznaki jako tytułu?","multiple_grant":"przyznana wielokrotnie?","badge_count":{"one":"1 odznaka","few":"%{count} odznaki","other":"%{count} odznak"},"more_badges":{"one":"+1 więcej","few":"+%{count} więcej","other":"+%{count} więcej"},"granted":{"one":"1 przyznane","few":"%{count} przyznanych","other":"%{count} przyznanych"},"select_badge_for_title":"Wybierz odznakę do użycia jako twój tytuł","no_title":"\u003cbrak tytułu\u003e","badge_grouping":{"getting_started":{"name":"Pierwsze kroki"},"community":{"name":"Społeczność"},"trust_level":{"name":"Poziom zaufania"},"other":{"name":"Inne"},"posting":{"name":"Wpisy"}},"badge":{"editor":{"name":"Edytor","description":"Pierwsza edycja"},"basic_user":{"name":"Podstawowy","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/4\"\u003ePrzyznano\u003c/a\u003e wszystkie podstawowe funkcje"},"regular_user":{"name":"Zwyczajny","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/5\"\u003ePrzyznano\u003c/a\u003e zaproszenia"},"leader":{"name":"Weteran","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/6\"\u003ePrzyznano\u003c/a\u003e możliwość zmiany kategorii, nazwy, linków oraz salon"},"elder":{"name":"Starszyzna","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/7\"\u003ePrzyznano\u003c/a\u003e możliwość globalnej edycji, przypinania, zamykania, archiwizacji, podziału i scalania"},"welcome":{"name":"Powitanie","description":"Otrzymano polubienie"},"autobiographer":{"name":"Autobiograf","description":"Wypełnienie \u003ca href=\"/my/preferences\"\u003eprofilu\u003c/a\u003e użytkownika"},"nice_post":{"name":"Niezły wpis","description":"Otrzymano 10 polubień za wpis. Ta odznaka może być przyznawana wielokrotnie"},"good_post":{"name":"Dobry wpis","description":"Otrzymano 25 polubień za wpis. Ta odznaka może być przyznawana wielokrotnie"},"great_post":{"name":"Wspaniały wpis","description":"Otrzymano 50 polubień za wpis. Ta odznaka może być przyznawana wielokrotnie"},"first_like":{"name":"Pierwsze polubienie","description":"Polubiono wpis"},"first_flag":{"name":"Pierwsza flaga","description":"Zgłoszenie wpisu"},"first_share":{"name":"Pierwsze udostępnienie","description":"Udostępniono wpis"},"first_link":{"name":"Pierwszy link","description":"Dodano wewnętrzny link do innego tematu"},"first_quote":{"name":"Pierwszy cytat","description":"Zacytowano użytkownika"},"read_guidelines":{"name":"Przeczytany przewodnik","description":"Przeczytanie \u003ca href=\"/guidelines\"\u003ewytycznych społeczności\u003c/a\u003e"},"reader":{"name":"Czytelnik","description":"Przeczytanie każdego wpisu w temacie z ponad 100 wpisami"}}}}}};
I18n.locale = 'pl_PL';
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
moment.fn.shortDateNoYear = function(){ return this.format('D. MMM'); };
moment.fn.shortDate = function(){ return this.format('D. MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('D. MMMM YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
