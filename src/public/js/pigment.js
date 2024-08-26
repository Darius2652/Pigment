function handle_modal(clicked_element, context) {
  return new Promise(function(resolve, reject) {
    let modal_config = $(clicked_element).children().find('.modal-config[data-context="'+context+'"]');
    if(modal_config.length == 0) return resolve();

    let config = {};
    config.title = modal_config.data('title');
    config.text = modal_config.data('text');
    config.icon = modal_config.data('icon');

    if(modal_config.data('type') == 'popup') {
      config.confirmButtonText = modal_config.data('confirm-text');
      config.cancelButtonText = modal_config.data('cancel-text');
      config.showCancelButton = !!modal_config.data('cancel');
      config.confirmButtonColor = '#D84545';
      config.cancelButtonColor = '#a7a7a7';
  
      Swal.fire(config).then(function(result) {
        if (!config.showCancelButton || result.isConfirmed) {
          return resolve();
        } else {
          return reject();
        }
      });
    }

    if(modal_config.data('type') == 'notification') {
      config.timeout = modal_config.data('timeout');

      let element_html = '';
      element_html += ' <div class="notification notification--'+config.icon+'">';
      element_html += '   <div class="notification__title">'+config.title+'</div>';
      element_html += '   <div class="notification__text">'+config.text+'</div>';
      element_html += ' </div>';
      let new_element = $('<div class="notification"><div class="notification__title"></div></div>');

      $('.notifications').appendChild(new_element);

      let timeout = parseInt(config.timeout) || 5000;
      setTimeout(function() {
        new_element.slideUp('slow', function() {
          $(this).remove();
        });
      }, timeout);
      return resolve();
    }
  })
}

$(document).on('click', '[data-href]', function() {
  let link = $(this).data('href');
  let new_tab = $(this).attr('target')?.toLowerCase() == "_blank";

  handle_modal(this).then(function() {
    if(new_tab) {
      window.open(link, "_blank");
    } else {
      window.location.href = link;
    }
  }).catch(function() {

  })
})
