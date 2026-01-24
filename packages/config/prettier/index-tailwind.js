/** @type {import('prettier').Config} */
const baseConfig = require('./index.js')

module.exports = {
  ...baseConfig,
  plugins: ['@trivago/prettier-plugin-sort-imports', 'prettier-plugin-tailwindcss'],
  tailwindFunctions: ['cx', 'tv', 'cn', 'cnJoin', 'twMerge', 'twJoin'],
}
