// Botkit bot
const Botkit = require('botkit');
const controller = Botkit.slackbot();
const bot = controller.spawn({
    token: process.env.SLACK_BOT_TOKEN
});

// Slack web client
const { WebClient } = require('@slack/client');
const slack = new WebClient(process.env.SLACK_TOKEN);

// Start bot RTM
bot.startRTM((err, bot, payload) => {
    if (err) {
        console.error('Could not connect to Slack', err);

        throw new Error('Could not connect to Slack');
    }

    console.log('startRTM', payload);
});

// Check if user has admin privileges
const userIsAdmin = (user, cb) =>
    slack.users.info(user)
        .then(({ user: { is_admin } }) => {
            if (!is_admin) {
                return bot.reply(message, 'Only admin users allowed.');
            }

            cb();
        });

// Types of file to delete
const types = ['images', 'zips', 'pdfs'].join(',');

/**
 * Iterate over all files from a certain page, based on a page count
 * @param {function} iterator
 * @param {object} options
 */
const iteratePageFiles = (iterator, options = {}) => {
    const listOptions = {
        page: 1,
        count: 5,
        types,
        ...options
    };

    return slack.files.list(listOptions)
        .then(response => {
            console.log('slack.files', response);

            const { paging: { pages, total }, files } = response;
            const mapFiles = files.map(iterator);

            return Promise.all(mapFiles)
                .then(() => {
                    if (listOptions.page < pages) {
                        return iteratePageFiles(iterator, {
                            ...listOptions, page: listOptions.page + 1
                        });
                    }

                    return total;
                });
        });
    };

// Events to listen for in channels and messages
const events = ['direct_message', 'direct_mention', 'mention'];

/**
 * Delete all files in the Slack team
 * @command rm -rf /
 */
controller.hears('rm -rf /', events, (bot, message) => {
    const { user } = message;
    const deleteFiles = ({ id }) => slack.files.delete(id);

    // Check if user has admin privileges
    userIsAdmin(user, () => {
        bot.reply(message, 'Cleaning the batcave :loading:');
            console.log('`rm -rf .`.message', message);

            iteratePageFiles(deleteFiles)
                .then(total => {
                    const cleanMessage = 'The batcave is now clean :batman:';
                    const reply = total ?
                        `Deleted ${total} bats :white_check_mark: ${cleanMessage}` :
                        'The batcave is already clean :batman:';

                    bot.reply(message, reply);
                })
                .catch(error => {
                    console.error('deletePageFiles', error);

                    bot.reply(message, 'The bats won :no_entry:');
                });
    });
});

/**
 * List all files in the Slack team
 * @command ls /
 */
controller.hears('ls /', events, (bot, message) => {
    const { user } = message;

    userIsAdmin(user, () => {
        iteratePageFiles(({ title, name }) => {
            const reply = title === name ? title : `${title}: \`${name}\``;

            return new Promise(resolve => bot.whisper(message, reply, resolve));
        })
            .then(total => {
                const reply = total ?
                    `There are ${total} bats in the batcave :batman:` :
                    'There are no bats :batman:';

                bot.reply(message, reply);
            });
    });
});

/**
 * Delete personal files in the Slack team
 * @command rm -rf ~
 */
controller.hears('rm -rf ~', events, (bot, message) => {
    const { user } = message;
    const deleteFiles = ({ id }) => slack.files.delete(id);

    bot.reply(message, 'Cleaning your personal batcave :loading:');
        console.log('`rm -rf ~`.message', message);

        iteratePageFiles(deleteFiles, { user })
            .then(total => {
                const cleanMessage = 'Your batcave is now clean :batman:';
                const reply = total ?
                    `Deleted ${total} bats :white_check_mark: ${cleanMessage}` :
                    'Your batcave is already clean :batman:';

                bot.reply(message, reply);
            })
            .catch(error => {
                console.error('deletePageFiles', error);

                bot.reply(message, 'The bats won :no_entry:');
            });
});

/**
 * List personal files in the Slack team
 * @command ls ~
 */
controller.hears('ls ~', events, (bot, message) => {
    const { user } = message;

    const listFiles = ({ title, name }) => {
        const reply = title === name ? title : `${title}: \`${name}\``;

        return new Promise(resolve => bot.whisper(message, reply, resolve));
    };

    iteratePageFiles(listFiles, { user })
        .then(total => {
            const reply = total ?
                `There are ${total} bats in your batcave :batman:` :
                'There are no bats :batman:';

            bot.reply(message, reply);
        });
});

const welcome = "I'm botman.";

module.exports = () => welcome;
