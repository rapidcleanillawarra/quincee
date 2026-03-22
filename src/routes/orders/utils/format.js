/**
 * Formats a number as Philippine Peso (PHP)
 * @param {number} val 
 * @returns {string}
 */
export const formatCurrency = (val) => {
	return new Intl.NumberFormat('en-PH', {
		style: 'currency',
		currency: 'PHP'
	}).format(val);
};
