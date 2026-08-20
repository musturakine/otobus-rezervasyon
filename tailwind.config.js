/** Tailwind yapılandırması
 *  Müşteri karşılama sayfası ve sorumlu giriş ekranı Tailwind kullanır.
 *  Yönetim paneli (app.html) kendi stil dosyasıyla çalışır.
 *
 *  Tema: Koyu (dark) · buzlu cam (glassmorphic) · altın vurgular
 *    gece  #0B132B / #0F172A   ·   altın #EAB308
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
      spacing: { 13: '3.25rem', 15: '3.75rem' },
      colors: {
        /* Derin gece mavisi — zeminler */
        gece: {
          950: '#070C1A',
          900: '#0B132B',
          800: '#0F172A',
          700: '#152142',
          600: '#1C2C56',
          500: '#24386B',
          400: '#38507F'
        },
        /* Altın sarı — vurgular */
        altin: {
          50:  '#FEFCE8',
          100: '#FEF9C3',
          200: '#FEF08A',
          300: '#FDE047',
          400: '#FACC15',
          500: '#EAB308',
          600: '#CA8A04',
          700: '#A16207'
        },
        /* Logodaki marka yeşili — rozet ve ikincil vurgular */
        marka: {
          300: '#7FC9A3',
          400: '#1E8A55',
          500: '#166B42',
          700: '#0D4A2C'
        }
      },
      boxShadow: {
        altin: '0 10px 30px -8px rgba(234,179,8,.45)',
        cam: '0 8px 32px 0 rgba(2,6,23,.55)'
      },
      backdropBlur: { cam: '14px' }
    }
  },
  plugins: []
};
