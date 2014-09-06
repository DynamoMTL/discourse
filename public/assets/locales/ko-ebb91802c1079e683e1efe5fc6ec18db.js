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
MessageFormat.locale.ko = function ( n ) {
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
r += "이 카테고리에 ";
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
r += "is <a href='/unread'>1개의 안 읽은</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "are <a href='/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "개의 안 읽은</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += " <a href='/new'>1개의 새로운</a> 토픽이";
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
})() + " 새로운</a> 토픽이";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " 남아 있고, ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["catLink"];
r += " 토픽도 확인해보세요.";
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
r += " ";
return r;
}});I18n.translations = {"ko":{"js":{"number":{"human":{"storage_units":{"format":"%n %u","units":{"byte":{"other":"바이트"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}}},"dates":{"time":"a h:mm","long_no_year":"MMM D a h:mm ","long_no_year_no_time":"MMM D","long_with_year":"YYYY  MMM D a h:mm","long_with_year_no_time":"YYYY MMM D","tiny":{"half_a_minute":"\u003c 1분","less_than_x_seconds":{"other":"\u003c %{count}초"},"x_seconds":{"other":"%{count}초 전"},"less_than_x_minutes":{"other":"\u003c %{count}분"},"x_minutes":{"other":"%{count}분 전"},"about_x_hours":{"other":"%{count}시간"},"x_days":{"other":"%{count}일 전"},"about_x_years":{"other":"%{count}년"},"over_x_years":{"other":"\u003e %{count}년"},"almost_x_years":{"other":"%{count}년"},"date_year":"'YY M/D"},"medium":{"x_minutes":{"other":"%{count}분"},"x_hours":{"other":"%{count}시간"},"x_days":{"other":"%{count}일"}},"medium_with_ago":{"x_minutes":{"other":"%{count}분 전"},"x_hours":{"other":"%{count}시간 전"},"x_days":{"other":"%{count}일 전"}}},"share":{"topic":"토픽을 공유합니다.","post":"#%{postNumber} 게시물을 공유합니다.","close":"닫기","twitter":"twitter로 공유","facebook":"Facebook으로 공유","google+":"Google+로 공유","email":"이메일로 공유"},"edit":"제목과 카테고리를 편집하기","not_implemented":"추후 업데이트 예정","no_value":"아니오","yes_value":"예","generic_error":"오류 발생","generic_error_with_reason":"에러 발견: %{error}","sign_up":"회원가입","log_in":"로그인","age":"생성","joined":"가입함","admin_title":"관리자","flags_title":"신고","show_more":"더 보기","links":"링크","links_lowercase":"링크","faq":"FAQ","guidelines":"가이드라인","privacy_policy":"개인보호 정책","privacy":"개인정보 취급방침","terms_of_service":"서비스 이용약관","mobile_view":"모바일로 보기","desktop_view":"PC로 보기","you":"당신","or":"또는","now":"방금 전","read_more":"더 읽기","more":"더 보기","less":"덜","never":"전혀","daily":"매일","weekly":"매주","every_two_weeks":"격주","max":"최대","character_count":{"other":"{{count}} 자"},"in_n_seconds":{"other":"in {{count}}초"},"in_n_minutes":{"other":"in {{count}}분"},"in_n_hours":{"other":"in {{count}}시간"},"in_n_days":{"other":"in {{count}}일"},"suggested_topics":{"title":"추천 토픽"},"about":{"simple_title":"About","title":"About %{title}","stats":"사이트 통계","our_admins":"관리자","our_moderators":"운영자","stat":{"all_time":"전체","last_7_days":"지난 7일"},"like_count":"좋아요","topic_count":"토픽","post_count":"게시글","user_count":"사용자"},"bookmarks":{"not_logged_in":"죄송합니다. 게시물을 즐겨찾기에 추가하려면 로그인을 해야 합니다.","created":"이 게시글을 북마크 하였습니다.","not_bookmarked":"이 게시물을 읽으셨습니다. 즐겨찾기에 추가하려면 클릭하세요.","last_read":"마지막으로 읽으신 게시물입니다. 즐겨찾기에 추가하려면 클릭하세요.","remove":"북마크 삭제"},"topic_count_latest":{"other":"{{count}} 새 토픽 혹은 업데이트된 토픽"},"topic_count_unread":{"other":"{{count}} 읽지 않은 토픽"},"topic_count_new":{"other":"{{count}}개의 새로운 토픽"},"click_to_show":"보려면 클릭하세요.","preview":"미리보기","cancel":"취소","save":"변경사항을 저장","saving":"저장 중...","saved":"저장 완료!","upload":"업로드","uploading":"업로드 중...","uploaded":"업로드 완료!","enable":"활성화","disable":"비활성화","undo":"실행 복귀","revert":"되돌리기","banner":{"close":"배너 닫기"},"choose_topic":{"none_found":"토픽이 없음","title":{"search":"이름, url, ID로 토픽 검색","placeholder":"여기에 토픽 제목을 입력"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e가 게시한 \u003ca href='{{topicUrl}}'\u003e토픽\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003e당신\u003c/a\u003e이 게시한 \u003ca href='{{topicUrl}}'\u003e토픽\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e가 게시한 답글 \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e개","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003e당신\u003c/a\u003e이 게시한 답글 \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e개","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e가 \u003ca href='{{topicUrl}}'\u003e토픽\u003c/a\u003e에 게시한 답글","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e당신\u003c/a\u003e이 \u003ca href='{{topicUrl}}'\u003e토픽\u003c/a\u003e에 게시한 답글","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}가\u003c/a\u003e \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e를 언급","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}가\u003c/a\u003e \u003ca href='{{user2Url}}'\u003e당신\u003c/a\u003e을 언급","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003e당신은\u003c/a\u003e \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e를 언급","posted_by_user":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e에 의해 게시됨","posted_by_you":"\u003ca href='{{userUrl}}'\u003e당신\u003c/a\u003e 게시함","sent_by_user":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e가 보냄","sent_by_you":"\u003ca href='{{userUrl}}'\u003e당신\u003c/a\u003e이 보냄"},"groups":{"visible":"모든 사용자에게 보이는 그룹입니다.","title":{"other":"그룹"},"members":"멤버","posts":"게시글","alias_levels":{"title":"누가 이 그룹을 가명으로 사용할 수 있는가","nobody":"0명","only_admins":"관리자만","mods_and_admins":"운영자 및 관리자만","members_mods_and_admins":"그룹 멤버, 운영자, 관리자만","everyone":"모두"}},"user_action_groups":{"1":"좋아함","2":"내 글을 좋아함","3":"북마크","4":"토픽","5":"게시글","6":"답글","7":"언급","9":"인용","10":"즐겨찾기","11":"편집","12":"보낸 편지함","13":"받은 편지함"},"categories":{"all":"전체 카테고리","all_subcategories":"모든 하위 카테고리","no_subcategory":"없음","category":"카테고리","posts":"게시글","topics":"토픽들","latest":"최신","latest_by":"가장 최근","toggle_ordering":"정렬 컨트롤 토글","subcategories":"하위 카테고리:","topic_stats":"새 토픽의 수","topic_stat_sentence":{"other":"지난 %{unit} 동안 %{count}개의 새로운 토픽이 있습니다."},"post_stats":"The number of new posts.","post_stat_sentence":{"other":"지난 %{unit} 동안 %{count}개의 새로운 게시글이 있습니다."}},"ip_lookup":{"title":"IP Address Lookup","hostname":"Hostname","location":"위치","location_not_found":"(알수없음)","organisation":"소속","phone":"전화","other_accounts":"이 IP 주소로 접속한 다른 계정","no_other_accounts":"(없음)"},"user":{"said":"{{username}}의 말:","profile":"프로필","mute":"음소거","edit":"편집","download_archive":"내 게시물을 아카이브로 다운로드","private_message":"개인 메시지","private_messages":"개인 메시지","activity_stream":"활동","preferences":"환경 설정","bookmarks":"북마크","bio":"프로필","invited_by":"에 의해 초대되었습니다.","trust_level":"레벨","notifications":"알림","disable_jump_reply":"댓글을 작성했을 때, 새로 작성한 댓글로 화면을 이동하지 않습니다.","dynamic_favicon":"새로운 메시지 알림을 Favicon으로 보여줍니다. (실험적 기능)","edit_history_public":"내 글의 리비전을 다른 사용자들이 볼 수 있게 허용","external_links_in_new_tab":"새 탭에서 모든 외부 링크 열기","enable_quoting":"강조 표시된 텍스트에 대한 알림을 사용합니다","change":"변경","moderator":"{{user}}는 운영자입니다.","admin":"{{user}} 는 관리자입니다.","moderator_tooltip":"이 사용자는 운영자 입니다","admin_tooltip":"이 사용자는 관리자입니다.","suspended_notice":"이 사용자는 {{date}}까지 접근 금지 되었습니다.","suspended_reason":"이유: ","watched_categories":"모든 알림 받기","watched_categories_instructions":"이 카테고리들에 있는 모든 새로운 토픽에 대한 알림을 켭니다. 새로운 글과 토픽이 작성될 때마다 알림이 오고, 읽지 않은 글과 새로운 글 수가 토픽의 리스트에 나타납니다.","tracked_categories":"새 글 표시하기","tracked_categories_instructions":"현재 카테고리에 있는 모든 토픽을 추적합니다. 읽지 않은 글과 새로운 글 수가 토픽의 리스트에 나타납니다.","muted_categories":"알림 끄기","muted_categories_instructions":"이 카테고리들에 새로 작성되는 새로운 토픽에 대한 알림이 오지 않도록 합니다. '읽지 않은'탭에서도 보이지 않게 됩니다.","delete_account":"내 계정 삭제","delete_account_confirm":"영구적으로 당신의 계정을 삭제해도 되겠습니까? 이 작업은 되돌릴 수 없습니다.","deleted_yourself":"성공적으로 당신의 계정이 삭제 되었습니다.","delete_yourself_not_allowed":"지금은 당신의 계정을 삭제할 수 없습니다. 관리자에게 당신의 계정을 삭제해달라고 연락해보세요.","unread_message_count":"메시지","staff_counters":{"flags_given":"유용한 신고","flagged_posts":"신고된 게시글","deleted_posts":"삭제된 글","suspensions":"정지시킨 계정"},"messages":{"all":"전체","mine":"내가 보낸 메세지","unread":"읽지 않음"},"change_password":{"success":"(이메일 전송)","in_progress":"(이메일 전송중)","error":"(에러)","action":"패스워드 변경 이메일 전송","set_password":"비밀번호 설정"},"change_about":{"title":"내정보 변경"},"change_username":{"title":"아이디 변경","confirm":"아이디을 변경합니다. 모든 @아이디 언급이 끊어집니다. 사용자 이름을 변경하는게 확실한가요?","taken":"죄송합니다. 중복된 아이디입니다.","error":"아이디를 변경하는 중에 오류가 발생했습니다.","invalid":"아이디가 잘못되었습니다. 숫자와 문자를 포함해야합니다."},"change_email":{"title":"이메일 수정","taken":"죄송합니다. 해당 이메일은 사용할 수 없습니다.","error":"이메일 변경 중 오류가 발생했습니다. 이미 사용중인 이메일인지 확인해주세요.","success":"이메일 발송이 완료되었습니다. 확인하신 후 절차에 따라주세요."},"change_avatar":{"title":"아바타 변경","gravatar":"\u003ca href='//gravatar.com/emails' target='_blank'\u003eGravatar\u003c/a\u003e 기반","refresh_gravatar_title":"Gravatar 새로고침","letter_based":"자동 생성된 아바타","uploaded_avatar":"커스텀 사진","uploaded_avatar_empty":"커스텀 사진 추가","upload_title":"프로필 사진 업로드","upload_picture":"사진 업로드","image_is_not_a_square":"경고: 사진을 정사각형으로 수정하였습니다."},"change_profile_background":{"title":"프로필 배경"},"email":{"title":"이메일","ok":"완료. 확인 이메일을 보냈습니다.","invalid":"사용하고 계시는 이메일 주소를 입력해주세요.","authenticated":"당신의 이메일은 {{provider}}에 의해 인증되었습니다.","frequency":"당신의 활동이 뜸해지거나 저희가 보낸 이메일에 포함된 글들을 읽지 못하셨다면 확인 이메일을 보내드립니다."},"name":{"title":"별명","too_short":"너무 짧습니다.","ok":"사용가능합니다."},"username":{"title":"아이디","short_instructions":"@{{username}}으로 언급이 가능합니다.","available":"아이디\u001d로 사용가능합니다.","global_match":"이메일이 등록된 아이디와 일치합니다.","global_mismatch":"이미 등록된 아이디입니다. 다시 시도해보세요. {{suggestion}}","not_available":"사용할 수 없는 아이디입니다. 다시 시도해보세요. {{suggestion}}","too_short":"아이디가 너무 짧습니다.","too_long":"아이디가 너무 깁니다.","checking":"사용가능한지 확인 중...","enter_email":"아이디를 찾았습니다. 일치하는 이메일을 입력해주세요.","prefilled":"이메일이 등록된 아이디와 연결되어 있습니다."},"locale":{"title":"인터페이스 언어","default":"(기본)"},"password_confirmation":{"title":"비밀번호를 재입력해주세요."},"last_posted":"마지막글","last_emailed":"마지막 이메일","last_seen":"마지막 접속","created":"생성일","log_out":"로그아웃","location":"위치","website":"웹사이트","email_settings":"이메일","email_digests":{"title":"새로운 정보를 요약하여 이메일로 보내드립니다.","daily":"매일","weekly":"매주","bi_weekly":"격주"},"email_direct":"누군가가 게시물에 @사용자이름 또는 답글을 달 경우에 이메일을 받습니다.","email_private_messages":"누군가 당신에게 메세지를 보낼 때 이메일을 받습니다.","other_settings":"추가 사항","categories_settings":"카테고리","new_topic_duration":{"label":"새글을 정의해주세요.","not_viewed":"아직 안본 글","last_here":"마지막 방문이후 작성된 토픽","after_n_days":{"other":"지난 {{count}}일간 생성된 토픽"},"after_n_weeks":{"other":"지난 {{count}}주간 생성된 토픽"}},"auto_track_topics":"내가 게시한 글을 추적할 수 있습니다.","auto_track_options":{"never":"하지않음","always":"항상","after_n_seconds":{"other":"{{count}}초 후"},"after_n_minutes":{"other":"{{count}}분 후"}},"invited":{"search":"검색","title":"초대","user":"사용자 초대","none":"어떤 초대도 발견되지 않았습니다.","truncated":"처음 {{count}}개 초대장 보여주기","redeemed":"초대를 받았습니다.","redeemed_at":"에 초대되었습니다.","pending":"초대를 보류합니다.","topics_entered":"토픽이 입력되었습니다.","posts_read_count":"게시물 읽기","expired":"이 초대장의 기한이 만료되었습니다.","rescind":"삭제","rescinded":"초대가 제거되었습니다.","time_read":"읽은 시간","days_visited":"일일 방문","account_age_days":"일일 계정 나이","create":"이 포럼에 친구를 초대하기","bulk_invite":{"none":"아직 아무도 초대하지 않았습니다. 초대장을 각각 보내거나, \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003euploading a bulk invite file\u003c/a\u003e을 이용하여 단체 초대를 보낼 수 있습니다.","text":"파일로 대량 초대하기","uploading":"업로드 중","success":"파일이 성공적으로 업로드되었습니다. 곧 진행 상황을 알려드리겠습니다.","error":"'{{filename}}': {{message}} 업로드중 에러가 있었습니다."}},"password":{"title":"비밀번호","too_short":"암호가 너무 짧습니다.","common":"That password is too common.","ok":"적절한 암호입니다.","instructions":"Must be at least %{count} characters."},"ip_address":{"title":"마지막 IP 주소"},"registration_ip_address":{"title":"IP Address 등록"},"avatar":{"title":"아바타"},"title":{"title":"호칭"},"filters":{"all":"전체"},"stream":{"posted_by":"에 의해 작성되었습니다","sent_by":"에 의해 전송되었습니다","private_message":"비공개 메시지","the_topic":"토픽"}},"loading":"로딩 중...","errors":{"prev_page":"로드하는 중","reasons":{"network":"네트워크 에러","unknown":"에러"},"desc":{"network":"접속상태를 확인해주세요.","network_fixed":"문제가 해결된 것으로 보입니다.","unknown":"문제가 발생했습니다."},"buttons":{"back":"뒤로가기","again":"다시시도","fixed":"페이지 열기"}},"close":"닫기","assets_changed_confirm":"사이트가 업데이트 되었습니다. 새로고침하시겠습니까?","read_only_mode":{"enabled":"관리자가 일기 전용모드를 활성화 하였습니다. 컨텐츠를 읽을 수는 있지만 활동할 수는 없습니다.","login_disabled":"사이트가 읽기 전용모드로 되면서 로그인은 비활성화되었습니다."},"learn_more":"더 배우기","year":"년","year_desc":"지난 365일간 생성된 토픽","month":"월","month_desc":"지난 30일간 생성된 토픽","week":"주","week_desc":"지난 7일간 생성된 토픽","day":"일","first_post":"첫 번째 게시물","mute":"음소거","unmute":"음소거 해제","last_post":"최근 게시물","last_post_lowercase":"마지막 글","summary":{"description":"\u003cb\u003e{{count}}\u003c/b\u003e개의 답글이 있습니다.","description_time":"총 \u003cb\u003e{{count}}\u003c/b\u003e개의 댓글이 있습니다. 예상 소요 시간은 \u003cb\u003e{{readingTime}}분\u003c/b\u003e입니다..","enable":"이 토픽을 요약","disable":"Show All Posts"},"deleted_filter":{"enabled_description":"이 토픽은 삭제된 글들을 포함하고 있습니다. 삭제된 글을 보이지 않습니다.","disabled_description":"삭제된 글들을 표시하고 있습니다.","enable":"삭제된 글 숨김","disable":"삭제된 글 보기"},"private_message_info":{"title":"개인 메시지","invite":"다른 사람 초대","remove_allowed_user":"{{name}}에게서 온 개인 메시지를 삭제할까요?"},"email":"이메일","username":"아이디","last_seen":"마지막 접근","created":"생성","created_lowercase":"최초 글","trust_level":"신뢰도","search_hint":"username 혹은 email","create_account":{"title":"회원 가입","failed":"뭔가 잘못되었습니다. 이 메일은 등록이 되어있습니다. 비밀번호를 잊으셨다면 비밀번호 찾기를 눌러주세요."},"forgot_password":{"title":"비밀번호를 찾기","action":"비밀번호를 잊어버렸습니다.","invite":"사용자 이름 또는 이메일 주소를 입력하시면 비밀번호 재설정 이메일을 보내드립니다.","reset":"암호 재설정","complete_username":"당신의 계정이  \u003cb\u003e%{username}\u003c/b\u003e와 일치한다면, 곧 비밀번호 초기화 방법과 관련된 안내 메일을 받게 됩니다.","complete_email":"만약 계정이 \u003cb\u003e%{email}\u003c/b\u003e과 일치한다면, 비밀번호를 재설정하는 방법에 대한 이메일을 곧 받게 됩니다."},"login":{"title":"로그인","username":"사용자","password":"비밀번호","email_placeholder":"이메일 주소 또는 사용자 이름","caps_lock_warning":"Caps Lock 켜짐","error":"알 수없는 오류","blank_username_or_password":"이메일 또는 사용자명과 비밀번호를 입력해 주세요.","reset_password":"암호 재설정","logging_in":"로그인 중..","or":"또는","authenticating":"인증 중...","awaiting_confirmation":"계정 활성화를 기다리고 있습니다. 다른 인증 이메일을 받고 싶으면 비밀번호 찾기를 누르세요.","awaiting_approval":"당신의 계정은 아직 스태프에 의해 승인되지 않았습니다. 승인되면 이메일을 받게됩니다.","requires_invite":"죄송합니다. 초대를 받은 사람만 이용하실 수 있습니다.","not_activated":"당신은 아직 로그인 할 수 없습니다. 계정을 만들었을때 \u003cb\u003e {{sentTo}} \u003c/b\u003e 주소로 인증 이메일을 보냈습니다. 계정을 활성화하려면 해당 이메일의 지침을 따르십시오.","resend_activation_email":"다시 인증 이메일을 보내려면 여기를 클릭하세요.","sent_activation_email_again":"\u003cb\u003e {{currentEmail}} \u003c/b\u003e 주소로 인증 이메일을 보냈습니다. 이메일이 도착하기까지 몇 분 정도 걸릴 수 있습니다. 또한 스팸 메일을 확인하십시오.","google":{"title":"Google","message":"Google 인증 중(팝업 차단을 해제 하세요)"},"google_oauth2":{"title":"with Google","message":"구글을 통해 인증 중 (파업이 허용되어 있는지 확인해주세요.)"},"twitter":{"title":"with Twitter","message":"Twitter 인증 중(팝업 차단을 해제 하세요)"},"facebook":{"title":"with Facebook","message":"Facebook 인증 중(팝업 차단을 해제 하세요)"},"yahoo":{"title":"Yahoo","message":"Yahoo 인증 중(팝업 차단을 해제 하세요)"},"github":{"title":"GitHub","message":"GitHub 인증 중(팝업 차단을 해제 하세요)"}},"composer":{"posting_not_on_topic":"어떤 토픽에 답글을 작성하시겠습니까?","saving_draft_tip":"저장 중...","saved_draft_tip":"저장 완료","saved_local_draft_tip":"로컬로 저장됩니다.","similar_topics":"작성하려는 내용과 비슷한 토픽들...","drafts_offline":"초안","min_length":{"need_more_for_title":"제목을 {{n}}글자 더 입력해주세요","need_more_for_reply":"내용을 {{n}}글자 더 입력해주세요"},"error":{"title_missing":"제목은 필수 항목입니다","title_too_short":"제목은 최소 {{min}} 글자 이상이어야 합니다.","title_too_long":"제목은 {{max}} 글자 이상일 수 없습니다.","post_missing":"게시글 내용은 필수 입니다.","post_length":"게시글은 최소 {{min}} 글자 이상이어야 합니다.","category_missing":"카테고리를 선택해주세요."},"save_edit":"편집 저장","reply_original":"기존 토픽에 대해 답글을 작성합니다.","reply_here":"여기에 답글을 작성하세요.","reply":"답글 전송","cancel":"취소","create_topic":"토픽 만들기","create_pm":"개인 메시지를 작성합니다.","title":"혹은 Ctrl + Enter 누름","users_placeholder":"사용자 추가","title_placeholder":"이야기 나누고자 하는 내용을 한문장으로 적는다면?","edit_reason_placeholder":"why are you editing?","show_edit_reason":"(add edit reason)","reply_placeholder":"여기에 입력하세요. 마크 다운이나 BBCode 형식을 사용하세요. 드래그\u0026드랍으로 이미지를 넣습니다.","view_new_post":"새로운 게시물을 볼 수 있습니다.","saving":"저장 중...","saved":"저장 완료!","saved_draft":"작성중인 글이 있습니다. 계속 작성하려면 여기를 클릭하세요.","uploading":"업로딩 중...","show_preview":"미리보기를 보여줍니다 \u0026laquo;","hide_preview":"\u0026laquo; 미리보기를 숨기기","quote_post_title":"전체 게시물을 인용","bold_title":"굵게","bold_text":"굵게하기","italic_title":"강조","italic_text":"강조하기","link_title":"하이퍼링크","link_description":"링크 설명을 입력","link_dialog_title":"하이퍼링크 삽입","link_optional_text":"옵션 제목","quote_title":"인용구","quote_text":"인용구","code_title":"코드 샘플","code_text":"미리 지정된 양식 사용은 4개의 띄어쓰기로 들여쓰세요.","upload_title":"업로드","upload_description":"업로드 설명을 입력","olist_title":"번호 매기기 목록","ulist_title":"글 머리 기호 목록","list_item":"토픽","heading_title":"표제","heading_text":"표제","hr_title":"수평선","undo_title":"취소","redo_title":"다시","help":"마크다운 편집 도움말","toggler":"작성 패널을 숨기거나 표시","admin_options_title":"이 토픽에 대한 옵션 설정","auto_close_label":"자동 토픽 닫기: ","auto_close_units":"일","auto_close_examples":"정확한 시간을 입력하세요. — 24, 17:00, 2013-11-22 14:00","auto_close_error":"Please enter a valid value."},"notifications":{"title":"@사용자이름 언급, 게시글과 토픽에 대한 언급, 개인 메시지 등에 대한 알림","none":"현재 알림이 없습니다.","more":"이전 알림을 볼 수 있습니다.","total_flagged":"관심 표시된 총 게시글","mentioned":"\u003ci title='mentioned' class='icon'\u003e@\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","quoted":"\u003ci title='quoted' class='fa fa-quote-right'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","replied":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","posted":"\u003ci title='replied' class='fa fa-reply'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","edited":"\u003ci title='edited' class='fa fa-pencil'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","liked":"\u003ci title='liked' class='fa fa-heart'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invited_to_private_message":"\u003ci title='private message' class='fa fa-envelope-o'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e","invitee_accepted":"\u003ci title='accepted your invitation' class='fa fa-user'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e accepted your invitation\u003c/p\u003e","moved_post":"\u003ci title='moved post' class='fa fa-sign-out'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e moved {{description}}\u003c/p\u003e","linked":"\u003ci title='linked post' class='fa fa-arrow-left'\u003e\u003c/i\u003e\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}\u003c/p\u003e"},"upload_selector":{"title":"이미지 추가하기","title_with_attachments":"이미지 또는 파일 추가하기","from_my_computer":"컴퓨터에서 가져오기","from_the_web":"인터넷에서 가져오기","remote_tip":"http://example.com/image.jpg 형식으로 이미지 주소를 입력","remote_tip_with_attachments":"http://example.com/file.ext 형식으로 이미지나 파일의 주소를 입력 (사용 가능한 확장자: {{authorized_extensions}})","local_tip":"내 컴퓨터에서 이미지를 가져오기","local_tip_with_attachments":"내 컴퓨터에서 이미지나 파일 가져오기 (사용 가능한 확장자: {{authorized_extensions}})","hint":"(드래그\u0026드랍으로 업로드 가능)","hint_for_supported_browsers":"(이미지 파일을 드래그\u0026드랍하거나 붙여넣기하여 업로드 할 수 있습니다.)","uploading":"업로드 중입니다...","image_link":"이 이미지를 누르면 이동할 링크"},"search":{"title":"토픽, 게시글, 사용자, 카테고리 검색","no_results":"검색 결과가 없습니다","searching":"검색중...","context":{"user":"@{{username}}의 글 검색","category":"\"{{category}}\" 카테고리 검색","topic":"이 토픽을 검색"}},"site_map":"다른 토픽이나 카테고리로 이동","go_back":"돌아가기","not_logged_in_user":"user page with summary of current activity and preferences","current_user":"사용자 페이지로 이동","starred":{"title":"즐겨찾기","help":{"star":"즐겨찾기로 이 토픽을 추가","unstar":"즐겨찾기에서 이 토픽을 제거"}},"topics":{"bulk":{"reset_read":"읽기 초기화","delete":"토픽 삭제","dismiss_posts":"게시글 닫기","dismiss_posts_tooltip":"이 토픽들의 '읽지 않은' 표시를 없애고 새 토픽이 발생하면 내 '읽지 않은' 목록에 표시하기","dismiss_topics":"토픽 닫기","dismiss_topics_tooltip":"새글이 발생할 때 내 '읽지 않은' 목록에 표시하지 않기","dismiss_new":"새글 제거","toggle":"복수토픽 선택 기능","actions":"일괄 적용","change_category":"카테고리 변경","close_topics":"토픽 닫기","notification_level":"알림 설정 변경","selected":{"other":"\u003cb\u003e{{count}}\u003c/b\u003e개의 토픽이 선택되었습니다."}},"none":{"starred":"아직 즐겨찾기가 없습니다. 토픽을 즐겨찾기하려면 제목 옆 별표를 눌러주세요.","unread":"읽지 않은 토픽이 없습니다.","new":"읽을 새로운 토픽이 없습니다.","read":"아직 어떠한 토픽도 읽지 않았습니다.","posted":"아직 어떠한 토픽도 작성되지 않았습니다.","latest":"최신 토픽이 없습니다.","hot":"인기있는 토픽이 없습니다.","category":"{{category}}에 토픽이 없습니다.","top":"Top 토픽이 없습니다."},"bottom":{"latest":"더 이상 읽을 최신 토픽이 없습니다","hot":"더 이상 읽을 인기있는 토픽이 없습니다","posted":"더 이상 작성된 토픽이 없습니다","read":"더 이상 읽을 토픽이 없습니다","new":"더 이상 읽을 새로운 토픽이 없습니다.","unread":"더 이상 읽지 않은 토픽이 없습니다","starred":"더 이상 읽을 즐겨찾기 토픽이 없습니다","category":"더 이상 {{category}}에 토픽이 없습니다","top":"더 이상 인기 토픽이 없습니다."}},"topic":{"filter_to":"이 토픽에서 {{username}}님의 {{post_count}}건의 게시물만 보기","create":"토픽 만들기","create_long":"새로운 토픽을 개설","private_message":"개인 메시지를 작성","list":"토픽 목록","new":"새로운 토픽","unread":"읽지 않은","new_topics":{"other":"{{count}}개의 새로운 토픽"},"unread_topics":{"other":"{{count}}개의 읽지 않은 토픽"},"title":"토픽","loading_more":"더 많은 토픽을 로딩 중...","loading":"토픽을 로딩 중...","invalid_access":{"title":"이 토픽은 비공개입니다","description":"죄송합니다. 그 토픽에 접근 할 수 없습니다!","login_required":"해당 토픽을 보려면 로그인이 필요합니다."},"server_error":{"title":"토픽을 불러오지 못했습니다","description":"죄송합니다. 연결 문제로 인해 해당 토픽을 불러올 수 없습니다. 다시 시도하십시오. 문제가 지속되면 문의해 주시기 바랍니다"},"not_found":{"title":"토픽을 찾을 수 없습니다","description":"죄송합니다. 토픽을 찾을 수 없습니다. 아마도 운영자에 의해 삭제된 것 같습니다."},"total_unread_posts":{"other":"이 토픽에 {{count}}개의 읽지 않을 게시 글이 있습니다."},"unread_posts":{"other":"이 토픽에 {{count}}개의 읽지 않을 게시 글이 있습니다."},"new_posts":{"other":"최근 읽은 이후 {{count}}개 글이 이 토픽 작성되었습니다."},"likes":{"other":"이 토픽에 {{count}}개의 '좋아요'가 있습니다."},"back_to_list":"토픽 리스트로 돌아갑니다.","options":"토픽 옵션","show_links":"이 토픽에서 링크를 표시합니다.","toggle_information":"토픽의 세부 정보를 토글합니다.","read_more_in_category":"더 많은 토픽들은 {{catLink}} 또는 {{latestLink}}에서 찾으실 수 있습니다","read_more":"{{catLink}} 또는 {{latestLink}}에서 더 많은 토픽들을 찾으실 수 있습니다","browse_all_categories":"모든 카테고리 보기","view_latest_topics":"최신 토픽 보기","suggest_create_topic":"토픽(글)을 작성 해 보실래요?","jump_reply_up":"이전 답글로 이동","jump_reply_down":"이후 답글로 이동","deleted":"토픽이 삭제되었습니다","auto_close_notice":"이 토픽은 곧 자동으로 닫힙니다. %{timeLeft}.","auto_close_title":"자동으로 닫기 설정","auto_close_save":"저장","auto_close_remove":"이 토픽을 자동으로 닫지 않기","progress":{"title":"진행 중인 토픽","go_top":"맨위","go_bottom":"맨아래","go":"이동","jump_bottom_with_number":"jump to post %{post_number}","total":"총 게시글","current":"현재 게시글","position":"post %{current} of %{total}"},"notifications":{"reasons":{"3_6":"이 카테고리를 보고 있어서 알림을 받게 됩니다.","3_5":"자동으로 이 게시물을 보고있어서 알림을 받게 됩니다.","3_2":"이 토픽을 보고있어서 알림을 받게 됩니다.","3_1":"이 토픽을 생성하여서 알림을 받게 됩니다.","3":"이 토픽을 보고있어서 알림을 받게 됩니다.","2_8":"이 토픽을 추적하고 있어서 알림을 받게 됩니다.","2_4":"이 토픽에 답글을 게시하여서 알림을 받게 됩니다.","2_2":"이 토픽을 추적하고 있어서 알림을 받게 됩니다.","2":"이 토픽을 읽어서 알림을 받게 됩니다. \u003ca href=\"/users/{{username}}/preferences\"\u003e(설정)\u003c/a\u003e","1_2":"누군가가 게시물에 @사용자이름 또는 답글을 달 경우에 알림을 받게 됩니다.","1":"누군가가 게시물에 @사용자이름 또는 답글을 달 경우에 알림을 받게 됩니다.","0_7":"당신은 이 토픽에 관한 모든 알림을 무시합니다.","0_2":"당신은 이 토픽에 관한 모든 알림을 무시합니다.","0":"당신은 이 토픽에 관한 모든 알림을 무시합니다."},"watching_pm":{"title":"알림 : 주시 중","description":"현재 개인 메시지의 모든 게시글에 대해 알림을 받습니다. 읽지 않은 글과 새로운 글 수를 볼 수 있습니다."},"watching":{"title":"주시 중","description":"모든 새 게시물에 대해 알림을 받습니다. 읽지 않은 글과 새로운 게시물 수를 볼 수 있습니다."},"tracking_pm":{"title":"알림 : 새 글 표시 중","description":"읽지 않은 글과 새로운 게시물 수를 볼 수 있습니다. 누군가 당신의 @name을 언급했거나 당신의 글에 답글을 작성하면 알림을 받습니다."},"tracking":{"title":"새 글 표시 중","description":"읽지 않은 글과 새로운 게시물 수를 볼 수 있습니다. 누군가 당신의 @name을 언급했거나 당신의 글에 답글을 작성하면 알림을 받습니다."},"regular":{"title":"알림: 일반","description":"누군가가 게시물에 @사용자이름 또는 답글을 달 경우에 알림을 받게 됩니다."},"regular_pm":{"title":"알림: 일반","description":"누군가 당신의 @name 으로 언급했거나 당신의 글에 답글이 달릴 때만 알림을 받게 됩니다."},"muted_pm":{"title":"알림 : 끔","description":"이 개인 메시지에 대해 어떠한 알림도 받지 않지 않습니다."},"muted":{"title":"알림 없음","description":"아무 알림도 없습니다. '읽지 않은 글' 탭에 나타나지 않습니다."}},"actions":{"recover":"토픽 다시 복구","delete":"토픽 삭제","open":"토픽 열기","close":"토픽 닫기","auto_close":"자동으로 닫기","make_banner":"배너 토픽","remove_banner":"배너 토픽 제거","unpin":"토픽 고정 취소","pin":"토픽 고정","pin_globally":"전체 공지글로 설정하기","unarchive":"보관 안된 토픽","archive":"보관된 토픽","invisible":"토픽 숨기기","visible":"토픽 보이기","reset_read":"값 재설정","multi_select":"게시글 이동을 위한 다중 선택"},"reply":{"title":"답글","help":"이 토픽에 대한 답글 구성 시작"},"clear_pin":{"title":"고정 취소","help":"더 이상 목록의 맨 위에 표시하지 않도록 이 토픽의 고정 상태를 해제합니다."},"share":{"title":"공유","help":"이 토픽의 링크를 공유"},"flag_topic":{"title":"신고","help":"운영자에게 이 글을 신고합니다.","success_message":"성공적으로 토픽을 신고 하였습니다."},"inviting":"초대 중...","automatically_add_to_groups_optional":"이 초대는 다음 그룹에 대한 접근 권한을 포함합니다: (선택, 관리자만 가능)","automatically_add_to_groups_required":"이 초대는 다음 그룹에 대한 접근 권한을 포함합니다: (필수, 관리자만 가능)","invite_private":{"title":"개인 메시지에 초대","email_or_username":"초대하려는 이메일 또는 아이디","email_or_username_placeholder":"이메일 또는 아이디","action":"초대","success":"사용자가 개인 메세지에 참여할 수 있도록 초대했습니다.","error":"죄송합니다. 해당 사용자를 초대하는 도중 오류가 발생했습니다.","group_name":"그룹명"},"invite_reply":{"title":"초대하기","action":"이메일 초대","help":"한 번의 클릭으로 이 토픽에 답글을 추가할 수 있도록 친구에게 초대장을 보낼 수 있습니다.","to_topic":"로그인이나 가입 없이 클릭 한번으로 이 토픽에 답글을 달 수 있도록 이메일을 친구에게 전송합니다.","to_forum":"친구에게 요약 이메일을 보내고 이 포럼에 가입할 수 있도록 링크를 전송합니다.","email_placeholder":"이메일 주소","success":"\u003cb\u003e{{email}}\u003c/b\u003e 메일로 초대장을 발송했습니다. 초대를 수락하면 알려 드리겠습니다. 초대상태를 확인하려면 사용자 페이지에서 '초대장' 탭을 선택하세요.","error":"죄송합니다. 그 사람을 초대 할 수 없습니다. 혹시 이미 포럼 사용자입니까?"},"login_reply":"로그인하고 답글 쓰기","filters":{"n_posts":{"other":"{{count}} 글"},"cancel":"다시 이 토픽의 모든 게시물을 표시합니다."},"split_topic":{"title":"새로운 토픽으로 이동","action":"새로운 토픽으로 이동","topic_name":"새로운 토픽 이름","error":"새로운 토픽으로 이동시키는데 문제가 발생하였습니다.","instructions":{"other":"새로운 토픽을 생성하여, 선택한 \u003cb\u003e{{count}}\u003c/b\u003e개의 글로 채우려고 합니다."}},"merge_topic":{"title":"이미 있는 토픽으로 옴기기","action":"이미 있는 토픽으로 옴기기","error":"이 토픽을 이동시키는데 문제가 발생하였습니다.","instructions":{"other":" \u003cb\u003e{{count}}\u003c/b\u003e개의 게시물을 옮길 토픽을 선택해주세요."}},"change_owner":{"title":"글 소유자 변경","action":"작성자 바꾸기","error":"작성자를 바꾸는 중 에러가 발생하였습니다.","label":"글의 새로운 작성자","placeholder":"새로운 작성자의 아이디","instructions":{"other":"\u003cb\u003e{{old_user}}\u003c/b\u003e(이)가 작성한 글의 새로운 작성자를 선택해주세요."},"instructions_warn":"이 글에 대한 알림이 새 사용자에게 자동으로 이전되지 않습니다.\n\u003cbr\u003e경고: 글과 연관된 데이터가 새로운 사용자로 이전되지 않습니다. 주의해서 사용하세요."},"multi_select":{"select":"선택","selected":"({{count}})개가 선택됨","select_replies":"선택 + 답글","delete":"선택 삭제","cancel":"선택을 취소","select_all":"전체 선택","deselect_all":"전체 선택 해제","description":{"other":"\u003cb\u003e{{count}}\u003c/b\u003e개의 개시글을 선택하셨어요."}}},"post":{"reply":"{{replyAvatar}} {{username}}님의 글에 답글 작성","reply_topic":"{{link}}에 답글 작성","quote_reply":"인용한 답글","edit":"{{replyAvatar}} {{username}}님의 글에 답글 편집","edit_reason":"Reason: ","post_number":"{{number}}번째 게시물","in_reply_to":"답글 to","last_edited_on":"마지막으로 편집:","reply_as_new_topic":"새로운 토픽으로 답글 달기","continue_discussion":"{{postLink}}에서 토론을 계속:","follow_quote":"인용 글로 이동","show_full":"전체 글 보기","show_hidden":"숨겨진 내용을 표시","deleted_by_author":{"other":"(작성자에 의해 취소된 글입니다. 신고당한 글이 아니면 %{count} 시간 뒤에 자동으로 삭제됩니다)"},"expand_collapse":"확장/축소","gap":{"other":"{{count}}개의 게시글이 숨겨져있어요."},"more_links":"{{count}}개 더...","unread":"읽지 않은 포스트","has_replies":{"other":"답글"},"errors":{"create":"죄송합니다. 게시물을 만드는 동안 오류가 발생했습니다. 다시 시도하십시오.","edit":"죄송합니다. 게시물을 수정하는 중에 오류가 발생했습니다. 다시 시도하십시오.","upload":"죄송합니다. 파일을 업로드하는 동안 오류가 발생했습니다. 다시 시도하십시오.","attachment_too_large":"업로드하려는 파일의 크기가 너무 큽니다. 최대 크기는 {{max_size_kb}}kb 입니다.","image_too_large":"업로드하려는 이미지의 크기가 너무 큽니다. 최대 크기는 {{max_size_kb}}kb 입니다. 사이즈를 조정하고 다시 시도해보세요.","too_many_uploads":"한번에 한 파일만 업로드 하실 수 있습니다.","upload_not_authorized":"업로드 하시려는 파일 확장자는 사용이 불가능합니다 (사용가능 확장자: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"죄송합니다. 새로운 유저는 이미지를 업로드 하실 수 없습니다.","attachment_upload_not_allowed_for_new_user":"죄송합니다. 새로운 유저는 파일 첨부를 업로드 하실 수 없습니다."},"abandon":{"confirm":"게시물 작성을 취소 하시겠습니까?","no_value":"아니오","yes_value":"예"},"archetypes":{"save":"옵션 저장"},"controls":{"reply":"이 게시물에 대한 답글을 작성합니다.","like":"이 게시물을 좋아합니다.","has_liked":"'좋아요'를 눌렀습니다.","undo_like":"'좋아요' 취소하기","edit":"이 게시물을 편집합니다.","edit_anonymous":"이 토픽을 수정하려면 먼저 로그인을 해야합니다.","flag":"운영자에게 이 글을 신고합니다.","delete":"이 게시물을 삭제합니다.","undelete":"이 게시물 삭제를 취소합니다.","share":"이 게시물에 대한 링크를 공유합니다.","more":"더","delete_replies":{"confirm":{"other":"이 게시글에 작성된 {{count}}개의 댓글도 삭제하시겠습니까?"},"yes_value":"예, 답글도 삭제합니다.","no_value":"아니오, 게시글만 삭제합니다."},"admin":"관리자 기능","wiki":"Wiki post","unwiki":"Unwiki post"},"actions":{"flag":"신고","defer_flags":{"other":"신고 연기"},"it_too":{"off_topic":"Flag it too","spam":"저도 신고합니다","inappropriate":"저도 신고합니다","custom_flag":"신고 추가하기","bookmark":"Bookmark it too","like":"저도 '좋아요' 줄래요","vote":"Vote for it too"},"undo":{"off_topic":"X","spam":"신고 취소","inappropriate":"신고 취소","bookmark":"X","like":"'좋아요' 취소하기","vote":"X"},"people":{"off_topic":"{{icons}}님이 이 게시물을 토픽에서 제외했습니다.","spam":"{{icons}} 스팸으로 신고되었습니다","inappropriate":"{{icons}} 부적절하다고 신고했습니다","notify_moderators":"{{icons}}님은 이 게시물을 운영자에게 보고했습니다.","notify_moderators_with_url":"{{icons}}님은 이 \u003ca href='{{postUrl}}'\u003e게시물\u003c/a\u003e을 운영자에게 보고했습니다.","notify_user":"{{icons}}님은 작성자에게 개인 메시지를 보냈습니다.","notify_user_with_url":"{{icons}}님은 작성자에게 \u003ca href='{{postUrl}}'\u003e개인 메세지\u003c/a\u003e를 보냈습니다.","bookmark":"{{icons}}님이 북마크했습니다.","like":"{{icons}}님이 좋아합니다.","vote":"{{icons}}님이 투표했습니다."},"by_you":{"off_topic":"당신은 이 게시물을 토픽에서 벗어남으로 신고했습니다.","spam":"당신은 이 게시물을 스팸으로 신고했습니다.","inappropriate":"당신은 이 게시물을 부적절하다고 신고했습니다","notify_moderators":"당신은 이 게시물을 운영자에게 보고했습니다.","notify_user":"당신은 작성자에게 개인 메시지를 보냈습니다.","bookmark":"당신은 이 게시물을 북마크했습니다.","like":"당신은 이 게시물을 좋아합니다.","vote":"당신은 이 게시물을 위해 투표했습니다."},"by_you_and_others":{"off_topic":{"other":"당신과 {{count}}명의 다른 사용자가 이 게시물을 토픽에서 제외했습니다."},"spam":{"other":"당신과 {{count}}명의 다른 사람들이 스팸이라고 신고했습니다"},"inappropriate":{"other":"당신과 {{count}}명의 다른 사람들이 부적절하다고 신고했습니다"},"notify_moderators":{"other":"당신과 {{count}}명의 다른 사람들이 적당하다고 표시했습니다."},"notify_user":{"other":"당신과 {{count}}명의 사용자가 작성자에게 개인 메시지를 보냈습니다."},"bookmark":{"other":"당신과 {{count}}명의 다른 사람들이 북마크 했습니다."},"like":{"other":"당신과 {{count}}명의 다른 사람들이 좋아합니다."},"vote":{"other":"당신과 {{count}}명의 다른 사람들이 이 포스트에 투표했습니다."}},"by_others":{"off_topic":{"other":"{{count}}명의 사용자가 이 게시물을 토픽에서 제외했습니다."},"spam":{"other":"{{count}}명의 사람들이 스팸이라고 신고했습니다"},"inappropriate":{"other":"{{count}}명의 사람들이 부적절하다고 신고했습니다"},"notify_moderators":{"other":"{{count}}명의 사람들이 이 게시물을 운영자에게 신고했습니다"},"notify_user":{"other":"{{count}}명이 이 사용자에게 개인 메시지를 보냈습니다."},"bookmark":{"other":"{{count}}명의 사용자가 이 게시물을 북마크했습니다."},"like":{"other":"{{count}}명이 이 글을 좋아합니다"},"vote":{"other":"{{count}}명의 사용자가 이 게시물을 추천했습니다."}}},"edits":{"one":"하나 편집","other":"{{count}}개 편집","zero":"편집 안함"},"delete":{"confirm":{"other":"모든 게시물들을 삭제하시겠습니까?"}},"revisions":{"controls":{"first":"First revision","previous":"Previous revision","next":"Next revision","last":"Last revision","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e vs \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Show the rendered output with additions and removals inline","button":"\u003ci class=\"fa fa-square-o\"\u003e\u003c/i\u003e HTML"},"side_by_side":{"title":"Show the rendered output diffs side-by-side","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e HTML"},"side_by_side_markdown":{"title":"Show the markdown source diffs side-by-side","button":"\u003ci class=\"fa fa-columns\"\u003e\u003c/i\u003e Markdown"}},"details":{"edited_by":"Edited by"}}},"category":{"can":"허용","none":"(카테고리 없음)","choose":"카테고리를 선택하세요\u0026hellip;","edit":"편집","edit_long":"카테고리 편집","view":"카테고리안의 토픽보기","general":"일반","settings":"설정","delete":"카테고리 삭제","create":"카테고리 생성","save":"카테고리 저장","creation_error":"카테고리 생성 중 오류가 발생했습니다.","save_error":"카테고리 저장 중 오류가 발생했습니다.","name":"카테고리 이름","description":"설명","topic":"카테고리 토픽","logo":"카테고리 로고 이미지","background_image":"카테고리 백그라운드 이미지","badge_colors":"훈장 색상","background_color":"배경 색상","foreground_color":"글씨 색상","name_placeholder":"짧고 간결해야합니다","color_placeholder":"웹 색상","delete_confirm":"이 카테고리를 삭제 하시겠습니까?","delete_error":"카테고리를 삭제하는 동안 오류가 발생했습니다.","list":"카테고리 목록","no_description":"이 카테고리에 대한 설명을 추가해주세요.","change_in_category_topic":"설명 편집","already_used":"이 색은 다른 카테고리에서 사용되고 있습니다.","security":"보안","images":"이미지","auto_close_label":"토픽 자동 닫기 :","auto_close_units":"hours","email_in":"incoming 메일 주소 수정","email_in_allow_strangers":"계정이 없는 익명 유저들에게 이메일을 받습니다.","email_in_disabled":"이메일로 새 토픽 작성하기 기능이 비활성화되어 있습니다. 사이트 설정에서 '이메일로 새 토픽작성하기'를 활성화 해주세요.","email_in_disabled_click":"\"email in\" 활성화","allow_badges_label":"뱃지가 이 카테고리에서 주어질 수 있도록 허용","edit_permissions":"권한 수정","add_permission":"권한 추가","this_year":"올해","position":"위치","default_position":"Default Position","parent":"부모 카테고리","notifications":{"watching":{"title":"주시 중","description":"현재 카테고리에 있는 모든 토픽을 주시합니다. 읽지 않은 글과 새로운 글 수가 토픽의 리스트에 나타납니다."},"tracking":{"title":"새 글 표시 중","description":"현재 카테고리에 있는 모든 토픽을 추적합니다. 읽지 않은 글과 새로운 글 수가 토픽의 리스트에 나타납니다."},"regular":{"title":"알림: 일반","description":"누군가 당신의 @name 으로 언급했거나 당신의 글에 답글이 달릴 때만 알림을 받게 됩니다."},"muted":{"title":"알림 꺼짐","description":"이 카테고리의 새로운 토픽에 대한 알림을 받지 않고 읽지 않\u001c은 탭에도 표시하지 않습니다."}}},"flagging":{"title":"게시글을 신고하는 이유를 알려주세요.","action":"게시물 신고하기","take_action":"조치를 취하기","notify_action":"알림","delete_spammer":"스팸 사용자 삭제","delete_confirm":"당신은 이 사용자의 %{posts}개의 게시글과 %{topics}개의 토픽을 삭제하고 IP주소 %{ip_address}와 이메일 %{email}을 영구 블락 합니다. 이 사용자가 진짜 악성 사용자 입니까? ","yes_delete_spammer":"예, 스팸 사용자 삭제.","submit_tooltip":"신고 접수하기","take_action_tooltip":"커뮤니티의 신고 수가 채워지기 기다리지 않고, 바로 신고 수를 제재 수준까지 채웁니다.","cant":"죄송합니다, 당신은 지금 이 게시물을 신고 할 수 없습니다.","custom_placeholder_notify_user":"해당 유저에게 게인 메세지를 보내 이 문제를 해결할 수 있습니다.","custom_placeholder_notify_moderators":"이 게시물을 운영자에게 알리겠습니까? 구체적으로 사용자님께서 걱정하는 것과 가능한 모든 관련된 링크를 제공해주세요.","custom_message":{"at_least":"최소한 {{n}}자를 입력하세요","more":"{{n}} 이동합니다","left":"{{n}} 나머지"}},"flagging_topic":{"title":"왜 이 토픽을 신고하시나요?","action":"신고된 토픽","notify_action":"비공개 메시지"},"topic_map":{"title":"토픽 요약","links_shown":"show all {{totalLinks}} links...","clicks":{"other":"%{count}번 클릭"}},"topic_statuses":{"locked":{"help":"이 토픽은 폐쇄되었습니다. 더 이상 새 답글을 받을 수 없습니다."},"unpinned":{"title":"핀 제거","help":"이 토픽은 핀 제거 되었습니다. 목록에서 기본적인 순서대로 표시됩니다."},"pinned_globally":{"title":"핀 지정됨 (전역적)","help":"이 토픽은 전역적으로 핀 지정 되었습니다. 모든 목록의 최상위에 표시됩니다."},"pinned":{"title":"핀 지정됨","help":"이 토픽은 고정되었습니다. 카테고리의 상단에 표시됩니다."},"archived":{"help":"이 토픽은 보관중입니다. 고정되어 변경이 불가능합니다."},"invisible":{"help":"이 토픽은 보이지 않습니다. 이제 토픽 목록에 표시되지 않습니다. ​​단지 직접적인 링크를 통해서만 접근 할 수 있습니다"}},"posts":"게시물","posts_lowercase":"게시글","posts_long":"이 토픽의 게시물 수는 {{number}}개 입니다.","original_post":"원본 게시물","views":"조회수","views_lowercase":"조회","replies":"답변","views_long":"이 토픽은 {{number}}번 조회 되었습니다.","activity":"활동","likes":"좋아요","likes_lowercase":"좋아요","likes_long":"이 주제에 {{number}}개의 '좋아요'가 있습니다.","users":"사용자","users_lowercase":"참여자","category_title":"카테고리","history":"기록","changed_by":"{{author}}에 의해","categories_list":"카테고리 목록","filters":{"with_topics":"%{filter} 토픽","with_category":"%{filter} %{category} 토픽","latest":{"title":"최신","help":"가장 최근 토픽"},"hot":{"title":"인기 있는 글","help":"가장 인기있는 토픽 중 하나를 선택"},"starred":{"title":"즐겨찾기","help":"즐겨찾기로 표시한 게시글"},"read":{"title":"읽기","help":"마지막으로 순서대로 읽은 토픽"},"categories":{"title":"카테고리","title_in":"카테고리 - {{categoryName}}","help":"카테고리별로 그룹화 된 모든 토픽"},"unread":{"title":{"zero":"읽지 않은","one":"읽지 않은(1)","other":"읽지 않은({{count}})"},"lower_title_with_count":{"one":"1개의 읽지 않은 글","other":"{{count}}개의 읽지 않은 글"}},"new":{"lower_title_with_count":{"one":"1 new","other":"{{count}} new"},"lower_title":"new","title":{"zero":"새로운","one":"새로운(1)","other":"새로운({{count}})"}},"posted":{"title":"내 게시물","help":"당신이 게시한 글"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"{{categoryName}}카테고리의 최신 토픽"},"top":{"title":"인기","yearly":{"title":"연간 인기글"},"monthly":{"title":"월간 인기글"},"weekly":{"title":"주간 인기글"},"daily":{"title":"일간 인기글"},"this_year":"이번 년도","this_month":"이번 달","this_week":"이번 주","today":"오늘","other_periods":"더 많은 인기 토픽 보기"}},"permission_types":{"full":"생성 / 답글 / 보기","create_post":"답글 / 보기","readonly":"보기"},"type_to_filter":"필터를 입력하세요","admin":{"title":"Discourse 운영","moderator":"운영자","dashboard":{"title":"대시보드","last_updated":"대시보드 최근 업데이트:","version":"버전","up_to_date":"최신상태입니다!","critical_available":"중요 업데이트를 사용할 수 있습니다.","updates_available":"업데이트를 사용할 수 있습니다.","please_upgrade":"업그레이드하세요.","no_check_performed":"A check for updates has not been performed. Ensure sidekiq is running.","stale_data":"A check for updates has not been performed lately. Ensure sidekiq is running.","version_check_pending":"최근에 업데이트 되었군요! 환상적입니다!!","installed_version":"설치됨","latest_version":"최근","problems_found":"몇몇의 문제들은 Disocouse 설치 과정에서 나타납니다.","last_checked":"마지막으로 확인","refresh_problems":"새로고침","no_problems":"아무런 문제가 발견되지 않았습니다.","moderators":"운영자:","admins":"관리자:","blocked":"블락됨:","suspended":"접근금지:","private_messages_short":"PMs","private_messages_title":"개인 메시지","reports":{"today":"오늘","yesterday":"어제","last_7_days":"최근 7일","last_30_days":"최근 30일","all_time":"모든 시간","7_days_ago":"7일","30_days_ago":"30일","all":"전체","view_table":"테이블로 보기","view_chart":"차트로 보기"}},"commits":{"latest_changes":"최근 변경 사항: 자주 업데이트하십시오!","by":"에 의해"},"flags":{"title":"신고","old":"지난","active":"활성화된","agree":"동의","agree_flag_modal_title":"동의 및 ...","agree_flag_hide_post":"동의 (포스트 숨기기 + 개인 메시지 보내기)","agree_flag_hide_post_title":"이 게시물을 숨기고 자동으로 해당 사용자에게 이 게시물의 편집을 요청하는 개인 메시지를 보냄","defer_flag":"연기","delete":"삭제","delete_flag_modal_title":"삭제하고..","delete_spammer":"스패머 삭제","disagree_flag_unhide_post":"Disagree (글 감추기 취소)","disagree_flag":"Disagree","clear_topic_flags":"완료","clear_topic_flags_title":"이 토픽을 조사하였고 이슈는 해결되었습니다. 플래그를 지우기 위해 완료를 클리하세요","dispositions":{"agreed":"agreed","disagreed":"disagreed"},"flagged_by":"신고 한 사람","resolved_by":"해결 by","took_action":"처리하기","system":"System","error":"뭔가 잘못 됐어요","reply_message":"답글","no_results":"신고가 없습니다.","topic_flagged":"이 \u003cstrong\u003e토픽\u003c/strong\u003e은 신고 되었습니다.","visit_topic":"처리하기 위해 토픽으로 이동","summary":{"action_type_3":{"other":"off-topic x{{count}}"},"action_type_4":{"other":"부적절한 x{{count}}"},"action_type_6":{"other":"custom x{{count}}"},"action_type_7":{"other":"custom x{{count}}"},"action_type_8":{"other":"스팸 x{{count}}"}}},"groups":{"primary":"주 그룹","no_primary":"(주 그룹이 없습니다.)","title":"그룹","edit":"그룹 수정","refresh":"새로고침","new":"새로운","selector_placeholder":"사용자 추가","name_placeholder":"그룹 이름, 사용자 이름처럼 빈칸 없이 작성","about":"회원과 이름을 변경","group_members":"그룹 멤버","delete":"삭제","delete_confirm":"이 그룹을 삭제 하시겠습니까?","delete_failed":"이것은 자동으로 생성된 그룹입니다. 삭제할 수 없습니다."},"api":{"generate_master":"마스터 API 키 생성","none":"지금 활성화된 API 키가 없습니다.","user":"사용자","title":"API","key":"API 키","generate":"API 키 생성","regenerate":"API 키 재생성","revoke":"폐지","confirm_regen":"API 키를 새로 발급 받으시겠습니까?","confirm_revoke":"API 키를 폐지하겠습니까?","info_html":"당신의 API 키는 JSON콜을 이용하여 토픽을 생성하거나 수정할 수 있습니다.","all_users":"전체 유저"},"backups":{"title":"백업","menu":{"backups":"백업","logs":"로그"},"none":"가능한 백업이 없습니다.","read_only":{"enable":{"title":"읽기 전용 모드 활성화하기","text":"읽기 전용 모드 활성화하기","confirm":"정말로 읽기 전용 모드를 활성화 하시겠습니까?"},"disable":{"title":"읽기 전용 모드 비활성화 하기","text":"읽기 전용 모드 비활성화 하기"}},"logs":{"none":"아직 로그가 없어요."},"columns":{"filename":"파일명","size":"크기"},"upload":{"text":"업로드","uploading":"업로드 중","success":"'{{filename}}' 파일이 성공적으로 업로드 되었습니다.","error":"'{{filename}}' 파일 업로드중 에러가 발생하였습니다. ({{message}})"},"operations":{"is_running":"실행 중입니다.","failed":"{{operation}} 작업 실행하지 못했습니다. 로그를 확인해 주세요.","cancel":{"text":"취소","title":"현제 작업 취소하기","confirm":"정말로 현재 작업을 취소하시겠습니까?"},"backup":{"text":"백업","title":"백업 생성","without_uploads":"네 (업로드 없이)"},"download":{"text":"다운로드","title":"백업 다운로드"},"destroy":{"text":"삭제","title":"백업 삭제","confirm":"정말 이 백업을 삭제할까요?"},"restore":{"is_disabled":"사이트 설정에서 '복구 기능'이 비활성화 되어있습니다.","text":"복구","title":"백업을 이용하여 복구","confirm":"정말 이 백업을 이용하여 복구할까요?"},"rollback":{"text":"롤백","title":"데이터베이스를 이전 workiong state로 되돌리기","confirm":"정말로 이전 작업 상태로 데이터베이스를 롤백하시겠습니까?"}}},"export_csv":{"users":{"text":"사용자 내보내기","title":"CSV 파일로 사용자 목록 내보내기"},"success":"내보내기가 시작되었습니다. 곧 진행사항을 알려드릴께요.","failed":"내보내기가 실패했습니다. 로그를 확인해주세요"},"customize":{"title":"사용자 지정","long_title":"사이트 사용자 지정","header":"헤더","css":"스타일","mobile_header":"모바일 헤더","mobile_css":"모바일 스타일시트","override_default":"표준 스타일 시트를 포함하지 마십시오","enabled":"사용가능?","preview":"미리 보기","undo_preview":"미리보기 삭제","rescue_preview":"기본 스타일","explain_preview":"이 커스텀 스타일시트를 적용한 상태로 사이트를 봅니다.","explain_undo_preview":"현재 적용되어 있는 커스톰 스타일시트로 돌아갑니다.","explain_rescue_preview":"기본 스타일시트를 적용한 상태로 사이트를 봅니다.","save":"저장","new":"새 사용자 지정","new_style":"새로운 스타일","delete":"삭제","delete_confirm":"이 정의를 삭제 하시겠습니까?","about":"사이트 Customization은 사이트의 스타일시트와 해더를 수정할 수 있게 해줍니다. 새로운 것을 추가하거나 기존 것을 선택해서 편집하세요.","color":"색","opacity":"투명도","copy":"복사","css_html":{"title":"CSS/HTML","long_title":"CSS, HTML 사용자 정의"},"colors":{"title":"색상","long_title":"색상 Schemes","about":"CSS 작성 없이 사이트에 사용되는 색을 수정합니다. 시작하려면 Scheme을 추가하세요.","new_name":"새로운 색 조합","copy_name_prefix":"복사본","delete_confirm":"이 컬러 스키마를 제거합니까?","undo":"실행 복귀","undo_title":"마지막 저장 상태로 색상 변경상태를 되돌리기","revert":"되돌리기","revert_title":"이 색상을 Dicsourse의 기본 색 스키마로 초기화","primary":{"name":"주요","description":"대부분의 글, 아이콘 및 테두리"},"secondary":{"name":"2차","description":"메인 백그라운드 색상, 몇몇 버튼의 텍스트 색상"},"tertiary":{"name":"3차","description":"링크, 버튼, 알림 및 강조를 위한 색"},"quaternary":{"name":"4차","description":"네비게이션 링크"},"header_background":{"name":"헤더 배경색","description":"사이트 헤더의 배경 색상"},"header_primary":{"name":"헤더 기본 색","description":"사이트 헤더에 텍스트와 아이콘"},"highlight":{"name":"하이라이트","description":"페이지 내에 강조된 글 및 토픽 등의 배경색"},"danger":{"name":"위험","description":"글 삭제 등에 사용되는 강조색"},"success":{"name":"성공","description":"동작이 성공적으로 수행되었음을 알립니다."},"love":{"name":"사랑","description":"좋아요 버튼 색"}}},"email":{"title":"이메일","settings":"설정","all":"전체","sending_test":"테스트 메일 발송중...","test_error":"테스트 메일을 전송하는데 문제가 있습니다. 메일 설정을 다시한번 체크해보고 메일 전송이 정상인지 다시 확인하고 시도해주세요.","sent":"보낸 메일","skipped":"생략","sent_at":"보냄","time":"시간","user":"사용자","email_type":"이메일 타입","to_address":"받는 주소","test_email_address":"테스트용 이메일 주소","send_test":"테스트 메일 전송","sent_test":"전송됨!","delivery_method":"전달 방법","preview_digest":"요약 미리보기","preview_digest_desc":"포럼에서 전송되는 요약 메일 미리보기 도구","refresh":"새로고침","format":"형식","html":"html","text":"문장","last_seen_user":"마지막으로 본 사용자","reply_key":"답글 단축키","skipped_reason":"생략 이유","logs":{"none":"로그가 없습니다.","filters":{"title":"필터","user_placeholder":"사용자명","address_placeholder":"name@example.com","type_placeholder":"다이제스트, 가입...","skipped_reason_placeholder":"이유"}}},"logs":{"title":"로그","action":"허용여부","created_at":"생성된","last_match_at":"마지막 방문","match_count":"방문","ip_address":"IP","delete":"삭제","edit":"편집","save":"저장","screened_actions":{"block":"블락","do_nothing":"아무것도 하지 않음"},"staff_actions":{"title":"스태프 기록","instructions":"사용자 이름을 클릭하고 리스트를 필터링하세요. 아바타를 클릭하여 사용자 페이지로 이동합니다.","clear_filters":"전체 보기","staff_user":"스태프 사용자","target_user":"타겟 사용자","subject":"제목","when":"언제","context":"상황","details":"상세","previous_value":"이전값","new_value":"새값","diff":"차이점","show":"보기","modal_title":"상세","no_previous":"이전 값이 없습니다.","deleted":"새로운 값이 없습니다. 기록이 삭제되었습니다.","actions":{"delete_user":"사용자 삭제","change_trust_level":"신뢰도 변경","change_site_setting":"사이트 설정 변경","change_site_customization":"사이트 커스텀화 변경","delete_site_customization":"사이트 커스텀화 삭제","suspend_user":"suspend user","unsuspend_user":"unsuspend user","grant_badge":"훈장 부여","revoke_badge":"훈장 회수"}},"screened_emails":{"title":"블락된 이메일들","description":"누군가가 새로운 계정을 만들면 아래 이메일 주소는 체크되고 등록은 블락됩니다, 또는 다른 조치가 취해집니다.","email":"이메일 주소","actions":{"allow":"허용"}},"screened_urls":{"title":"블락된 URL들","description":"이 목록은 사용자에 의해 스팸으로 알려진 URL 목록입니다.","url":"URL","domain":"도메인"},"screened_ips":{"title":"블락된 IP들","description":"IP 주소는 감시됩니다. \"허용\"으로 Whitelist에 등록해주세요.","delete_confirm":"%{ip_address}를 규칙에 의해 삭제할까요?","actions":{"block":"블락","do_nothing":"허용"},"form":{"label":"새 IP:","ip_address":"IP 주소","add":"추가"}},"logster":{"title":"에러 로그"}},"users":{"title":"사용자","create":"관리자 사용자 추가","last_emailed":"마지막 이메일","not_found":"죄송합니다, 그 이름은 시스템에 존재하지 않습니다.","active":"활동","nav":{"new":"새로운 사용자","active":"활성화 사용자","pending":"보류된 사용자","admins":"관리자 목록","moderators":"운영자","suspended":"접근 금지 사용자","blocked":"블락된 사용자"},"approved":"승인?","approved_selected":{"other":"승인한 사용자 ({{count}}명)"},"reject_selected":{"other":"거부한 사용자 ({{count}}명)"},"titles":{"active":"활성화된 사용자","new":"새로운 사용자","pending":"검토가 필요한 사용자","newuser":"사용자 신뢰도 0 (새로운 사용자)","basic":"사용자 신뢰도 1 (초보 사용자)","regular":"사용자 신뢰도 2 (자주오는 사용자)","elder":"사용자 신뢰도 4 (후원자)","admins":"관리자 사용자 목록","moderators":"운영자","blocked":"블락된 사용자들","suspended":"접근 금지된 사용자들"},"reject_successful":{"other":"성공적으로 ${count}명의 사용자를 거절하였습니다."},"reject_failures":{"other":"%{count}명의 사용자를 거부하는데 실패했습니다."}},"user":{"suspend_failed":"이 사용자를 접근 금지하는데 오류 발생 {{error}}","unsuspend_failed":"이 사용자를 접근 허용 하는데 오류 발생 {{error}}","suspend_duration":"사용자를 몇일 접근 금지 하시겠습니까?","suspend_duration_units":"(일)","suspend_reason_label":"Why are you suspending? This text \u003cb\u003ewill be visible to everyone\u003c/b\u003e on this user's profile page, and will be shown to the user when they try to log in. Keep it short.","suspend_reason":"Reason","suspended_by":"접근 금지자","delete_all_posts":"모든 글을 삭제합니다","delete_all_posts_confirm":"당신은 %{posts}개의 게시글과 %{topics}개의 토픽을 삭제합니다. 확실합니까?","suspend":"접근 금지","unsuspend":"접근 허용","suspended":"접근 금지?","moderator":"운영자?","admin":"관리자?","blocked":"블락","show_admin_profile":"관리자","edit_title":"제목 수정","save_title":"제목 저장","refresh_browsers":"브라우저 새로 고침","refresh_browsers_message":"모든 클라이언트에게 메시지 보내기","show_public_profile":"공개 프로필 보기","impersonate":"사용자로 로그인하기","ip_lookup":"IP Lookup","log_out":"로그아웃","logged_out":"사용자가 모든 디바이스에서 로그아웃 되었습니다.","revoke_admin":"관리자 권한 회수","grant_admin":"관리자 권한 부여","revoke_moderation":"운영자 권한 회수","grant_moderation":"운영자 권한 부여","unblock":"언블락","block":"블락","reputation":"평판","permissions":"권한","activity":"활동","like_count":"준/받은 '좋아요'","last_100_days":"지난 100일간","private_topics_count":"개인적인 토픽 수","posts_read_count":"게시글 읽은 수","post_count":"게시글 수","topics_entered":"읽은 토픽 수","flags_given_count":"작성한 신고","flags_received_count":"받은 신고","flags_given_received_count":"준/받은 신고","approve":"승인","approved_by":"승인자","approve_success":"인증 이메일이 발송되었습니다.","approve_bulk_success":"성공! 모든 선택된 사용자는 인증되었고 통보되었습니다.","time_read":"읽은 시간","delete":"사용자 삭제","delete_forbidden_because_staff":"관리자 및 운영자 계정은 삭제할 수 없습니다.","delete_forbidden":{"other":"사용자가 작성한 글이 있으면 사용자를 삭제 할 수 없습니다. 사용자를 삭제 하기 전에 사용자가 작성한 글을 모두 삭제해야 합니다. (%{count}일 이전에 작성한 글은 삭제할 수 없습니다.)"},"cant_delete_all_posts":{"other":"전체글을 삭제할 수 없습니다. 몇개의 글은 %{count}일 이전에 작성되었습니다. (The delete_user_max_post_age setting.)"},"cant_delete_all_too_many_posts":{"other":"이 사용자는 %{count}개 이상 글을 작성하였기 때문에 모든 글을 삭제 할 수 없습니다. (delete_all_posts_max 설정참고)"},"delete_confirm":"정말 이 사용자를 삭제하시겠습니다? 삭제하면 복구 할 수 없습니다.","delete_and_block":"이 이메일과 IP주소를 삭제하고 차단하기","delete_dont_block":"삭제만 하기","deleted":"사용자가 삭제되었습니다.","delete_failed":"해당 사용자를 삭제하는 동안 오류가 발생했습니다. 모든 글은 사용자를 삭제하기 전에 삭제해야합니다.","send_activation_email":"인증 메일 보내기","activation_email_sent":"인증 메일을 보냈습니다.","send_activation_email_failed":"인증 메일 전송중 오류 %{error}","activate":"계정 활성화","activate_failed":"사용자 활성화에 문제가 있습니다.","deactivate_account":"계정 비활성화","deactivate_failed":"사용자 비활성에 문제가 있습니다.","unblock_failed":"사용자 언블락에 문제가 있습니다.","block_failed":"사용자 블락에 문제가 있습니다.","deactivate_explanation":"비활성화 사용자는 이메일 인증을 다시 받아야합니다.","suspended_explanation":"접근 금지된 유저는 로그인 할 수 없습니다.","block_explanation":"블락 사용자는 게시글을 작성하거나 토픽을 작성할 수 없습니다.","trust_level_change_failed":"신뢰도 변경에 문제가 있습니다.","suspend_modal_title":"Suspend User","trust_level_2_users":"신뢰도 2 사용자들","trust_level_3_requirements":"사용자 신뢰도 3 이상이 필요","tl3_requirements":{"title":"레벨 3 권한이 필요합니다.","table_title":"최근 100일 간:","value_heading":"값","requirement_heading":"필수","visits":"방문수","days":"일","topics_replied_to":"답글 달린 토픽","topics_viewed":"읽은 토픽 수","topics_viewed_all_time":"읽은 토픽 수 (전체 기간)","posts_read":"읽은 글 수","posts_read_all_time":"읽은 글 수 (전체 기간)","flagged_posts":"신고된 글","flagged_by_users":"신고한 사용자들","likes_given":"선사한  '좋아요'","likes_received":"받은 '좋아요'","qualifies":"신뢰 등급 3의 조건에 부합합니다.","will_be_promoted":"24시간 내에 승급됩니다.","does_not_qualify":"신뢰 등급 3의 조건에 부합하지 않습니다."},"sso":{"title":"Single Sign On","external_id":"External ID","external_username":"Username","external_name":"Name","external_email":"Email","external_avatar_url":"Avatar URL"}},"site_content":{"none":"편집을 시작하려는 컨텐츠의 타입을 선택하세요.","title":"사이트 컨텐츠","edit":"사이트 컨텐츠를 편집"},"site_settings":{"show_overriden":"수정된 것만 표시","title":"사이트 설정","reset":"기본값으로 재설정","none":"없음","no_results":"No results found.","clear_filter":"Clear","categories":{"all_results":"All","required":"필수","basic":"기본 설정","users":"사용자","posting":"게시물","email":"이메일","files":"파일","trust":"신뢰도","security":"보안","onebox":"Onebox","seo":"SEO","spam":"스팸","rate_limits":"제한","developer":"개발자","embedding":"Embedding","legal":"합법적인","uncategorized":"카테고리 없음","backups":"백업","login":"로그인"}},"badges":{"title":"훈장","new_badge":"새로운 훈장","new":"새 훈장","name":"이름","badge":"훈장","display_name":"표시 이름","description":"설명","badge_type":"훈장 종류","badge_grouping":"그룹","badge_groupings":{"modal_title":"뱃지 그룹으로 나누기"},"granted_by":"훈장 부여자","granted_at":"훈장 수여일","save":"저장","delete":"삭제","delete_confirm":"정말로 이 훈장을 삭제하시겠습니까?","revoke":"회수","revoke_confirm":"정말로 이 훈장을 회수하시겠습니까?","edit_badges":"훈장 수정","grant_badge":"훈장 부여","granted_badges":"부여된 훈장","grant":"부여","no_user_badges":"%{name}님은 어떤 훈장도 받지 못했습니다.","no_badges":"받을 수 있는 훈장이 없습니다.","allow_title":"훈장을 제목으로 사용가능하도록 허용","multiple_grant":"중복 부여할 수 있도록 허용","listable":"공개 훈장 페이지에 표시되는 배지입니다.","enabled":"훈장 기능 사용","icon":"아이콘","query":"훈장 Query(SQL)","target_posts":"포스트들을 타겟으로 하는 query","auto_revoke":"매일 회수 query를 실행한다.","show_posts":"훈장 페이지에서 훈장을 받게한 포스트를 보여줍니다.","trigger":"Trigger","trigger_type":{"none":"매일 업데이트","post_action":"사용자가 포스트에 액션을 했을 때","post_revision":"사용자가 포스트를 수정거나 작성했을 때","trust_level_change":"사용자의 신뢰도가 변했을 떄","user_change":"사용자가 수정되거나 생성되었을 때"}}},"lightbox":{"download":"download"},"keyboard_shortcuts_help":{"title":"키보드 단축키","jump_to":{"title":"Jump To","home":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eh\u003c/b\u003e 홈 (Latest)","latest":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003el\u003c/b\u003e 최신","new":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003en\u003c/b\u003e 새로운","unread":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003eu\u003c/b\u003e 읽지 않은","starred":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ef\u003c/b\u003e 즐겨찾기","categories":"\u003cb\u003eg\u003c/b\u003e, \u003cb\u003ec\u003c/b\u003e 카테고리"},"navigation":{"title":"Navigation","jump":"\u003cb\u003e#\u003c/b\u003e 글 번호로 이동","back":"\u003cb\u003eu\u003c/b\u003e Back","up_down":"\u003cb\u003ek\u003c/b\u003e/\u003cb\u003ej\u003c/b\u003e Move selection up/down","open":"\u003cb\u003eo\u003c/b\u003e or \u003cb\u003eEnter\u003c/b\u003e 선택한 토픽에 들어갑니다."},"application":{"title":"Application","create":"\u003cb\u003ec\u003c/b\u003e 새 토픽을 만듭니다.","notifications":"\u003cb\u003en\u003c/b\u003e Open notifications","search":"\u003cb\u003e/\u003c/b\u003e Search","help":"\u003cb\u003e?\u003c/b\u003e Open keyboard shortcuts help"},"actions":{"title":"Actions","star":"\u003cb\u003ef\u003c/b\u003e 별표시 토픽","share_topic":"\u003cb\u003eshift s\u003c/b\u003e 토픽 공유","share_post":"\u003cb\u003es\u003c/b\u003e 게시글 공유","reply_topic":"\u003cb\u003eshift r\u003c/b\u003e 토픽에 답변 달기","reply_post":"\u003cb\u003er\u003c/b\u003e 게시글에 답글 달기","quote_post":"\u003cb\u003eq\u003c/b\u003e 인용 글","like":"\u003cb\u003el\u003c/b\u003e Like post","flag":"\u003cb\u003e!\u003c/b\u003e Flag post","bookmark":"\u003cb\u003eb\u003c/b\u003e Bookmark post","edit":"\u003cb\u003ee\u003c/b\u003e Edit post","delete":"\u003cb\u003ed\u003c/b\u003e Delete post","mark_muted":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003em\u003c/b\u003e 토픽 알람 : 끄기","mark_regular":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003er\u003c/b\u003e 토픽 알람 : 일반(기본)으로 설정하기","mark_tracking":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003et\u003c/b\u003e 토픽 알람 : 추적하기","mark_watching":"\u003cb\u003em\u003c/b\u003e, \u003cb\u003ew\u003c/b\u003e 토픽 알람 : 주시하기"}},"badges":{"title":"훈장","allow_title":"훈장을 제목으로 사용가능하도록 허용중인가요?","multiple_grant":"중복해서 부여할 수 있나요?","badge_count":{"other":"%{count} 훈장"},"more_badges":{"other":"+%{count} More"},"granted":{"other":"%{count} 개 부여"},"select_badge_for_title":"호칭으로 사용할 훈장을 선택하세요","no_title":"호칭 없음","badge_grouping":{"getting_started":{"name":"교육용 훈장"},"community":{"name":"커뮤니티 훈장"},"trust_level":{"name":"신뢰 등급 훈장"},"other":{"name":"기타 훈장"},"posting":{"name":"글 관련 훈장"}},"badge":{"editor":{"name":"편집자","description":"첫 포스트 편집"},"basic_user":{"name":"기본","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/4\"\u003e부여되면\u003c/a\u003e 커뮤니티의 기본 기능 수행 가능"},"regular_user":{"name":"일반","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/5\"\u003e부여되면\u003c/a\u003e 초대 가능"},"leader":{"name":"중견","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/6\"\u003e부여되면\u003c/a\u003e 토픽의 제목, 팔로우된 링크, 카테고리 변경 및 라운지 접근 가능"},"elder":{"name":"원로","description":"\u003ca href=\"https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/7\"\u003e부여되면\u003c/a\u003e 모든 포스트 수정, 보관, 내리기, 핀, 자르고 합치기 등 가능"},"welcome":{"name":"환영합니다","description":"좋아요 받음"},"autobiographer":{"name":"자서전 작가","description":"사용자의 \u003ca href=\"/my/preferences\"\u003e프로필\u003c/a\u003e 정보를 작성함"},"nice_post":{"name":"괜찮은 글","description":"작성한 글이 좋아요를 10개 받았습니다. 이 훈장은 중복 수여 가능합니다."},"good_post":{"name":"좋은 글","description":"작성한 글이 좋아요를 25개 받았습니다. 이 훈장은 중복 수여 가능합니다."},"great_post":{"name":"굉장히 좋은 글","description":"작성한 글이 좋아요를 50개 받았습니다. 이 훈장은 중복 수여 가능합니다."},"first_like":{"name":"첫 좋아요","description":"처음으로 글에 '좋아요'를 했습니다."},"first_flag":{"name":"첫 신고","description":"글을 처음으로 신고하였습니다."},"first_share":{"name":"첫 공유","description":"처음으로 글을 공유했습니다."},"first_link":{"name":"첫 링크","description":"글 작성시, 다른 토픽으로 가는 링크를 처음으로 추가하였습니다."},"first_quote":{"name":"첫 인용","description":"글 작성시 다른 사용자의 글을 인용하였습니다."},"read_guidelines":{"name":"가이드라인 읽음","description":"\u003ca href=\"/guidelines\"\u003e커뮤니티 가이드라인\u003c/a\u003e 을 읽었습니다."},"reader":{"name":"독서가","description":"100개가 넘는 댓글이 달린 토픽의 댓글을 모두 읽었습니다."}}}}}};
I18n.locale = 'ko';
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
// locale : korean (ko)
//
// authors
//
// - Kyungwook, Park : https://github.com/kyungw00k
// - Jeeeyul Lee <jeeeyul@gmail.com>
(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define(['moment'], factory); // AMD
    } else if (typeof exports === 'object') {
        module.exports = factory(require('../moment')); // Node
    } else {
        factory(window.moment); // Browser global
    }
}(function (moment) {
    return moment.defineLocale('ko', {
        months : "1월_2월_3월_4월_5월_6월_7월_8월_9월_10월_11월_12월".split("_"),
        monthsShort : "1월_2월_3월_4월_5월_6월_7월_8월_9월_10월_11월_12월".split("_"),
        weekdays : "일요일_월요일_화요일_수요일_목요일_금요일_토요일".split("_"),
        weekdaysShort : "일_월_화_수_목_금_토".split("_"),
        weekdaysMin : "일_월_화_수_목_금_토".split("_"),
        longDateFormat : {
            LT : "A h시 mm분",
            L : "YYYY.MM.DD",
            LL : "YYYY년 MMMM D일",
            LLL : "YYYY년 MMMM D일 LT",
            LLLL : "YYYY년 MMMM D일 dddd LT"
        },
        meridiem : function (hour, minute, isUpper) {
            return hour < 12 ? '오전' : '오후';
        },
        calendar : {
            sameDay : '오늘 LT',
            nextDay : '내일 LT',
            nextWeek : 'dddd LT',
            lastDay : '어제 LT',
            lastWeek : '지난주 dddd LT',
            sameElse : 'L'
        },
        relativeTime : {
            future : "%s 후",
            past : "%s 전",
            s : "몇초",
            ss : "%d초",
            m : "일분",
            mm : "%d분",
            h : "한시간",
            hh : "%d시간",
            d : "하루",
            dd : "%d일",
            M : "한달",
            MM : "%d달",
            y : "일년",
            yy : "%d년"
        },
        ordinal : '%d일',
        meridiemParse : /(오전|오후)/,
        isPM : function (token) {
            return token === "오후";
        }
    });
}));

moment.fn.shortDateNoYear = function(){ return this.format('MMM D'); };
moment.fn.shortDate = function(){ return this.format('YYYY-MMM-D'); };
moment.fn.longDate = function(){ return this.format('YYYY-MMM-D a h:mm'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
