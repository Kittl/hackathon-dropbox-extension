import { kittl } from '@kittl/sdk';

document.getElementById('doSomething')?.addEventListener('click', async () => {
  await kittl.design.text.addText({
    text: 'Hello test-ext-blesson from Kittl SDK!',
    position: {
      relative: {
        to: 'viewport',
        location: 'center',
      },
    },
    size: {
      height: 100,
      width: 400,
    },
  });
});
