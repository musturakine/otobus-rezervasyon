/** Tailwind yapılandırması
 *  Sadece müşteri karşılama sayfası ve sorumlu giriş ekranı Tailwind kullanır.
 *  Yönetim paneli (app.html) kendi stil dosyasıyla çalışır.
 *
 *  Renkler Serhendi Turizm logosundan alınmıştır:
 *    yeşil #166b42 · altın #d7bb55 · fildişi #f7f7f2
 *
 *  CSS'i yeniden üretmek için:  npm run stil
 */
module.exports = {
  content: [
    './public/anasayfa.html',
    './public/index.html'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'Roboto', '-apple-system', 'BlinkMacSystemFont', 'Helvetica Neue', 'Arial', 'sans-serif']
      },
      spacing: { 13: '3.25rem' },
      colors: {
        /* Marka yeşili */
        marka: {
          50:  '#eef6f1',
          100: '#d6eade',
          200: '#a9d4bd',
          300: '#7fc9a3',
          400: '#1e8a55',
          500: '#166b42',
          600: '#125b37',
          700: '#0d4a2c',
          800: '#08301d',
          900: '#062617'
        },
        /* Marka altını */
        altin: {
          100: '#f6efd4',
          200: '#ecdfa9',
          300: '#e3d086',
          400: '#d7bb55',
          500: '#c9a93f',
          600: '#b2953a',
          700: '#8d742c'
        },
        /* Logonun fildişi zemini */
        fildisi: '#f7f7f2'
      }
    }
  },
  plugins: []
};
