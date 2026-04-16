// ==============================|| MENU ITEMS - PAGES ||============================== //

const pages = {
  id: 'pages',
  title: 'Pages',
  type: 'group',
  children: [
    {
      id: 'authentication',
      title: 'Authentication',
      type: 'collapse',
      icon: 'ph ph-lock-key',
      children: [
        {
          id: 'login',
          title: 'Login',
          type: 'item',
          url: '/login',
          target: true
        },
        {
          id: 'signup',
          title: 'Signup',
          type: 'item',
          url: '/signup',
          target: true
        }
      ]
    }
  ]
};

export default pages;
