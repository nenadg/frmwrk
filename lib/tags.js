/**
 * list of supported html tags wrapped inside RegExp function
 * list should be updated regularly
 */
let tagsRe = new RegExp(
  "^(br|basefont|hr|input|source|frame|" +
    "param|area|meta|col|link|option|base|img|wbr|" +
    "a|abbr|acronym|address|applet|article|aside|audio|b|bdi|bdo|" +
    "big|blockquote|body|button|canvas|caption|center|cite|code|" +
    "colgroup|command|datalist|dd|del|details|dfn|dialog|dir|div|" +
    "dl|dt|em|embed|fieldset|figcaption|figure|font|footer|form|" +
    "frameset|head|header|hgroup|h1|h2|h3|h4|h5|h6|html|i|iframe|" +
    "ins|kbd|keygen|label|legend|li|map|mark|menu|menuitem|meter|nav|" +
    "noframes|noscript|object|ol|optgroup|output|p|pre|progress|" +
    "q|rp|rt|rtc|ruby|s|samp|script|section|select|small|slot|span|strike|" +
    "strong|style|sub|summary|sup|table|tbody|td|template|textarea|tfoot|" +
    "th|thead|time|title|tr|track|tt|u|ul|var|video|main|picture|portal|" +
    "svg|math|polyline|circle|animate|animateMotion|animateTransform|" +
    "audio|canvas|clipPath|defs|desc|discard|ellipse|feBlend|" +
    "feColorMatrix|feComponentTransfer|feComposite|feConvolveMatrix|" +
    "feDiffuseLighting|feDisplacementMap|feDistantLight|feDropShadow|" +
    "feFlood|feFuncA|feFuncB|feFuncG|feFuncR|feGaussianBlur|feImage|" +
    "feMerge|feMergeNode|feMorphology|feOffset|fePointLight|" +
    "feSpecularLighting|feSpotLight|feTile|feTurbulence|filter|" +
    "foreignObject|g|iframe|image|line|linearGradient|marker|mask|" +
    "metadata|mpath|path|pattern|polygon|polyline|radialGradient|" +
    "rect|set|stop|style|switch|symbol|text|textPath|tspan|" +
    "unknown|use|summary|track|webview|bgsound|isindex" +
    ")$",
  "i"
);

export default (tag) => tagsRe.test(tag);
