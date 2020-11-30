function decimalAdjust(type, value, exp) {
  // If the exp is undefined or zero...
  if (typeof exp === 'undefined' || +exp === 0) {
    return Math[type](value);
  }
  // eslint-disable-next-line no-param-reassign
  value = +value;
  // eslint-disable-next-line no-param-reassign
  exp = +exp;
  // If the value is not a number or the exp is not an integer...
  // eslint-disable-next-line no-restricted-globals
  if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
    return NaN;
  }
  // Shift
  // eslint-disable-next-line no-param-reassign
  value = value.toString().split('e');
  // eslint-disable-next-line no-param-reassign
  value = Math[type](+(`${value[0]}e${value[1] ? (+value[1] - exp) : -exp}`));
  // Shift back
  // eslint-disable-next-line no-param-reassign
  value = value.toString().split('e');
  return +(`${value[0]}e${value[1] ? (+value[1] + exp) : exp}`);
}

module.exports = { decimalAdjust };
