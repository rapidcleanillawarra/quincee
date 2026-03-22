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

export const formatDate = (dateString) => {
	if (!dateString) return 'N/A';
	const date = new Date(dateString);
	return date.toLocaleDateString('en-AU', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
};
