// English (default) and French text for the public pages.
// Language: ?lang=fr or ?lang=en in the link, then the visitor's last choice, otherwise French.
(function () {
  'use strict';
  const S = {
    en: {
      'doc.title': 'Beat Georges | BetGRW Pick’em',
      'skip': 'Skip to your picks',
      'nav.aria': 'Sections', 'nav.georges': 'Georges', 'nav.picks': 'Picks', 'nav.board': 'Leaderboard', 'nav.standings': 'Standings', 'nav.rules': 'Rules', 'nav.season': 'Season', 'nav.thisSat': 'This Saturday',
      'hdr.make': 'Make your picks', 'hdr.see': 'See results', 'hdr.deposit': 'Deposit',
      'hdr.live': '{n} live', 'hdr.lockIn': 'Picks lock in {t}', 'hdr.final': 'Final results', 'hdr.points': 'Your points',
      'hdr.meAria': '{name}, {n} points. See the leaderboard', 'lang.switch': 'Français', 'lang.switchAria': 'Afficher le site en français',
      'strip.aria': 'Saturday’s games', 'strip.none': 'No games this Saturday',
      'hub.title': 'Beat Georges', 'hub.sub': 'Saturday NHL Pick’em', 'hub.date': 'Date', 'hub.games': 'Games', 'hub.lockIn': 'Picks lock in', 'hub.status': 'Status',
      'hub.loading': 'Loading Saturday’s games', 'hub.loadFail': 'Saturday’s games couldn’t load. Retrying shortly.',
      'hub.nGames': '{n} NHL games', 'hub.noGames': 'No games', 'hub.allFinal': 'All games final', 'hub.liveNow': '{n} live now', 'hub.locked': 'Picks locked',
      'duel.you': 'You',
      'st.none': 'No NHL games this Saturday. The next Saturday shows up here automatically.',
      'st.finalNoMe': 'All {n} games are final. Georges got {g} right.',
      'st.youBeat': 'All games final. You beat Georges this Saturday.',
      'st.georgesWins': 'All games final. Georges wins this one.',
      'st.tied': 'All games final. You tied Georges.',
      'st.upcoming': '{n} games on Saturday. First puck drop at {time}.',
      'st.progress': '{f} of {n} games final.', 'st.progressLive': '{f} of {n} games final, {l} in progress.',
      'prize.aria': 'Prizes', 'prize.weeklySub': 'every Saturday', 'prize.weeklyHead': 'The top {n} split {pool} every Saturday',
      'prize.cta': 'Deposit at betgrw.com', 'prize.weeklyAria': 'Weekly prize for each place',
      'prize.seasonSub': 'season pool', 'prize.seasonHead': 'The top {n} of the {season} split {pool}', 'prize.seasonCta': 'Season standings',
      'prize.seasonAria': 'Season prize for each place',
      'prize.seasonNote': 'Season points are your correct picks added up over every Saturday from {start} to {end}. Miss a Saturday and it counts as 0.',
      'prize.rule': 'To be eligible, you need to deposit at least <b>$20</b> on betgrw.com in the <b>last 30 days</b>.',
      'season.name': '{y1}–{y2s} season',
      'expert.bio': 'BetGRW ambassador and former NHL enforcer. His winner in every Saturday game.',
      'expert.record': 'Record', 'expert.rate': 'Hit rate', 'expert.same': 'Same as you',
      'expert.notYet': 'Georges hasn’t posted his Saturday picks yet. Check back before the first puck drop.',
      'expert.noGames': 'No games this Saturday. Georges will be back next Saturday.',
      'expert.called': 'Called it', 'expert.missed': 'Missed',
      'g.live': 'Live', 'g.postponed': 'Postponed', 'g.final': 'Final', 'g.finalOT': 'Final/OT', 'g.finalSO': 'Final/SO', 'g.notFinal': 'Not final', 'g.at': '{a} at {h}',
      'picks.title': 'Your picks', 'picks.progress': '{n} of {t} picked',
      'picks.sub': 'Pick the winner of every Saturday game. Overtime and shootouts count.',
      'picks.subLock': 'Pick the winner of every Saturday game. Picks lock {day} at {time}.',
      'picks.today': 'today', 'picks.onDay': 'on {day}',
      'picks.lockedMe': 'Your picks are locked in. Winners mark themselves as games end.',
      'picks.lockedNo': 'Picks locked at the first puck drop. Come back next Saturday.',
      'picks.headPick': 'Your pick', 'picks.headGeorges': 'Georges', 'picks.home': 'Home', 'picks.away': 'Away',
      'picks.btnAria': 'Pick {team}', 'picks.btnShare': ', picked by {p}% of players', 'picks.georgesPick': 'Georges’ pick',
      'picks.agree': 'Same as Georges on {a} of {n}', 'picks.noGames': 'No NHL games on the schedule this Saturday. The next Saturday will show up here automatically.',
      'form.username': 'BetGRW username', 'form.usernamePh': 'e.g. HabsFan_514', 'form.usernameHelp': 'Your betgrw.com username. It shows on the leaderboard.',
      'form.email': 'Email', 'form.emailPh': 'you@example.com', 'form.emailHelp': 'We use it to contact you if you win. It’s never shown on the site.',
      'form.consent': 'Email me a reminder before each Saturday and news and offers from BetGRW. You can unsubscribe at any time.',
      'form.trap': 'Leave this empty',
      'btn.submit': 'Submit picks', 'btn.update': 'Update picks', 'btn.saved': 'Picks saved', 'btn.saving': 'Saving', 'btn.locked': 'Picks locked', 'btn.closed': 'Entries closed',
      'err.username': 'Add your BetGRW username first: 3 to 20 letters, numbers, dots, dashes or underscores.',
      'err.email': 'Add your email so we can contact you if you win.',
      'err.save': 'Your picks weren’t saved. Try again.',
      'ok.updated': 'Picks updated.', 'ok.in': 'You’re in, {name}. Good luck against Georges.',
      'rules.title': 'How it works',
      'rules.list': [
        'The contest runs on Saturday NHL games only. Pick a winner in every game on Saturday’s slate. Overtime and shootout results count.',
        'Saturday’s games open for picks on Tuesday, so you can pick any time during the week.',
        'Picks lock for everyone at the first puck drop. Until then you can change them as often as you like from this device.',
        'Each correct pick is worth one point. Winners and points update automatically as games end.',
        'Finish ahead of Georges and your name gets the “Beat Georges” mark.',
        'Postponed or cancelled games don’t count for anyone.',
        'Weekly prize: the top 10 players each Saturday split $500. 1st $150, 2nd $100, 3rd $70, 4th $50, 5th $40, 6th $30, 7th $22, 8th $16, 9th $12, 10th $10.',
        'Season prize: the top 20 players of the 2026–27 season split $5,000. 1st $1,500, 2nd $900, 3rd $600, 4th $400, 5th $300, 6th $250, 7th $200, 8th–10th $125 each, 11th–15th $55 each, 16th–20th $40 each.',
        'Season points are your correct picks added up over every Saturday from November 14, 2026 to April 10, 2027. A Saturday you miss counts as 0. Season prizes are paid after the last Saturday.',
        'Your email is required so we can contact you if you win. It’s never shown on the site. We only send reminders and offers if you tick the box, and you can unsubscribe at any time.',
        'One entry per email each Saturday.',
        'Use the same BetGRW username every week, from the same device. Your username is saved to your device the first time you enter, so nobody else can use it this season.',
        'Ties: players with the same score share the prizes for the places they cover. For example, two players tied for 2nd split the 2nd and 3rd place prizes.',
        'Georges is shown on the leaderboard for fun but doesn’t take a place or a prize.',
        'If a top-10 player isn’t eligible, the next eligible player moves up.',
        'One entry per person. Players with more than one entry are disqualified, and each internet connection is limited to a few entries per Saturday.',
        'To be eligible, you need to deposit at least $20 on betgrw.com in the last 30 days. Enter with your betgrw.com username so we can confirm it.'
      ],
      'board.title': 'Leaderboard', 'board.aria': 'Choose a leaderboard', 'board.week': 'This Saturday', 'board.season': 'Season',
      'th.player': 'Player', 'th.pts': 'Pts', 'th.prize': 'Prize',
      'board.final': '{g} of {t} final', 'board.players1': '{n} player', 'board.playersN': '{n} players',
      'board.empty': 'No entries yet. Make your picks and be the first name here.',
      'board.noteNoPrize': 'Top {n} split {pool}. Prizes show here once the first game ends.',
      'board.noteFinal': 'Final prizes. Ties share the prizes for the places they cover. Winners must be eligible.',
      'board.noteNow': 'Prizes as things stand now. Ties share the prizes for the places they cover. Winners must be eligible.',
      'board.showTop': 'Show top 10', 'board.showFull': 'Show full leaderboard', 'mark.you': 'You', 'mark.beat': 'Beat Georges',
      'season.loading': 'Loading the season.', 'season.week': 'Week {d} of {n}', 'season.weeks1': '{n} week', 'season.weeksN': '{n} weeks',
      'season.empty': 'The season table starts once the first game this Saturday ends.',
      'season.noteFinal': 'Final season standings. Ties share the prizes for the places they cover. Winners must be eligible.',
      'season.noteNow': 'Season prizes as things stand now, paid after the last Saturday ({end}). Ties share the prizes for the places they cover.',
      'season.showFull': 'Show full season table',
      'nhl.title': 'NHL standings', 'nhl.aria': 'Choose a standings view',
      'nhl.Atlantic': 'Atlantic', 'nhl.Metropolitan': 'Metro', 'nhl.Central': 'Central', 'nhl.Pacific': 'Pacific', 'nhl.League': 'League',
      'nhl.div.Atlantic': 'Atlantic Division', 'nhl.div.Metropolitan': 'Metropolitan Division', 'nhl.div.Central': 'Central Division', 'nhl.div.Pacific': 'Pacific Division', 'nhl.all': 'All 32 teams',
      'nhl.team': 'Team', 'nhl.gp': 'GP', 'nhl.w': 'W', 'nhl.l': 'L', 'nhl.ot': 'OT', 'nhl.pts': 'PTS',
      'nhl.gpT': 'Games played', 'nhl.wT': 'Wins', 'nhl.lT': 'Losses', 'nhl.otT': 'Overtime losses', 'nhl.ptsT': 'Points',
      'nhl.plays': 'Plays this Saturday', 'nhl.line': 'Line: top 3 in the division make the playoffs, plus 2 wild cards per conference.',
      'facts.aria': 'This Saturday in numbers', 'facts.players': 'players in', 'facts.final': 'games final', 'facts.ahead': 'ahead of Georges',
      'feed.title': 'Latest entries', 'feed.in': 'is in', 'feed.updated': 'updated their picks', 'feed.empty': 'No entries yet this Saturday.',
      'ago.now': 'now', 'ago.m': '{n}m', 'ago.h': '{n}h', 'ago.d': '{n}d',
      'until.min': '{n} min', 'until.h': '{h} h', 'until.hm': '{h} h {m} min', 'until.d1': '1 day', 'until.dN': '{d} days', 'until.dh': '{days} {h} h',
      'foot': '18+. Play responsibly. Game results from the NHL. BetGRW is not affiliated with the NHL or its teams.',
      // Season and results page
      'res.docTitle': 'Season and results | Beat Georges', 'res.skip': 'Skip to results', 'res.title': 'Season and results', 'res.sub': 'The season table and every finished Saturday',
      'res.back': 'All Saturdays', 'res.sats': 'Saturdays', 'res.satsN1': '{n} Saturday', 'res.satsN': '{n} Saturdays',
      'res.thSat': 'Saturday', 'res.thWinner': 'Winner', 'res.thTop': 'Top score', 'res.thGeorges': 'Georges', 'res.thBeat': 'Beat Georges', 'res.thPlayers': 'Players',
      'res.thWeeks': 'Weeks', 'res.thWins': 'Weekly wins', 'res.thBest': 'Best week',
      'res.unavailable': 'Results unavailable right now', 'res.noEntries': 'No entries', 'res.inProgress': 'In progress',
      'res.noneYet': 'No finished Saturdays yet. Results show up here after the first Saturday is over.',
      'res.loadFail': 'Past results couldn’t load.', 'res.dayFail': 'That Saturday couldn’t load.',
      'res.standings': '{season} standings', 'res.showTop50': 'Show top 50', 'res.showAllN': 'Show all {n} players',
      'res.seasonEmpty': 'The season table starts once the first Saturday game ends.',
      'res.seasonFinal': 'Final season standings. Winners must be eligible. Ties share the prizes for the places they cover.',
      'res.seasonNow': 'Prizes as things stand now. The {pool} season pool is paid to the top {n} after the last Saturday ({end}).',
      'res.fSeason': 'Season', 'res.fSeasonVal': '{start} to {end}', 'res.fPlayed': 'Saturdays played', 'res.fPlayedVal': '{d} of {n}', 'res.fPool': 'Season pool', 'res.fLeader': 'Leader',
      'res.final': 'Final results', 'res.partial': 'Results so far. Some games weren’t final yet.',
      'res.winner': 'Winner', 'res.winners': 'Winners', 'res.top': 'Top score', 'res.ofN': '{s} of {n}', 'res.players': 'Players',
      'res.finalStandings': 'Final standings', 'res.finalSub': '{n} players, {b} beat Georges', 'res.finalSub1': '{n} player, {b} beat Georges',
      'res.nobody': 'Nobody entered this Saturday.', 'res.showTop25': 'Show top 25', 'res.prizeNote': 'Prizes go to eligible players only. Ties share the prizes for the places they cover.',
      'res.games': 'Game results', 'res.georgesWent': 'Georges went {w}–{l}', 'res.dayTitle': '{date} results | Beat Georges',
      'names.and': '{a} and {b}', 'names.more': '{list} and {n} more',
      // Messages from the server
      'srv': [
        [/^Too many tries\. Wait a minute and submit again\.$/, 'Too many tries. Wait a minute and submit again.']
      ]
    },
    fr: {
      'doc.title': 'Battez Georges | Concours BetGRW',
      'skip': 'Aller à vos choix',
      'nav.aria': 'Sections', 'nav.georges': 'Georges', 'nav.picks': 'Choix', 'nav.board': 'Classement', 'nav.standings': 'LNH', 'nav.rules': 'Règlements', 'nav.season': 'Saison', 'nav.thisSat': 'Ce samedi',
      'hdr.make': 'Faites vos choix', 'hdr.see': 'Voir les résultats', 'hdr.deposit': 'Déposer',
      'hdr.live': '{n} en direct', 'hdr.lockIn': 'Fermeture dans {t}', 'hdr.final': 'Résultats finaux', 'hdr.points': 'Vos points',
      'hdr.meAria': '{name}, {n} points. Voir le classement', 'lang.switch': 'English', 'lang.switchAria': 'Show the site in English',
      'strip.aria': 'Matchs de samedi', 'strip.none': 'Aucun match ce samedi',
      'hub.title': 'Battez Georges', 'hub.sub': 'Concours de prédictions LNH du samedi', 'hub.date': 'Date', 'hub.games': 'Matchs', 'hub.lockIn': 'Fermeture', 'hub.status': 'Statut',
      'hub.loading': 'Chargement des matchs de samedi', 'hub.loadFail': 'Les matchs de samedi n’ont pas pu être chargés. Nouvel essai sous peu.',
      'hub.nGames': '{n} matchs LNH', 'hub.noGames': 'Aucun match', 'hub.allFinal': 'Tous les matchs terminés', 'hub.liveNow': '{n} en direct', 'hub.locked': 'Choix fermés',
      'duel.you': 'Vous',
      'st.none': 'Aucun match de la LNH ce samedi. Le prochain samedi s’affichera ici automatiquement.',
      'st.finalNoMe': 'Les {n} matchs sont terminés. Georges en a eu {g} de bons.',
      'st.youBeat': 'Tous les matchs sont terminés. Vous avez battu Georges ce samedi!',
      'st.georgesWins': 'Tous les matchs sont terminés. Georges l’emporte cette fois.',
      'st.tied': 'Tous les matchs sont terminés. Égalité avec Georges.',
      'st.upcoming': '{n} matchs samedi. Première mise au jeu à {time}.',
      'st.progress': '{f} des {n} matchs terminés.', 'st.progressLive': '{f} des {n} matchs terminés, {l} en cours.',
      'prize.aria': 'Prix', 'prize.weeklySub': 'chaque samedi', 'prize.weeklyHead': 'Les {n} premiers se partagent {pool} chaque samedi',
      'prize.cta': 'Déposer sur betgrw.com', 'prize.weeklyAria': 'Prix hebdomadaire par position',
      'prize.seasonSub': 'bourse de la saison', 'prize.seasonHead': 'Les {n} premiers de la {season} se partagent {pool}', 'prize.seasonCta': 'Classement de la saison',
      'prize.seasonAria': 'Prix de la saison par position',
      'prize.seasonNote': 'Vos points de saison sont le total de vos bons choix de chaque samedi, du {start} au {end}. Un samedi manqué compte pour 0.',
      'prize.rule': 'Pour être admissible, vous devez avoir déposé au moins <b>20 $</b> sur betgrw.com au cours des <b>30 derniers jours</b>.',
      'season.name': 'saison {y1}-{y2}',
      'expert.bio': 'Ambassadeur BetGRW et ancien dur à cuire de la LNH. Son gagnant pour chaque match du samedi.',
      'expert.record': 'Fiche', 'expert.rate': 'Taux de réussite', 'expert.same': 'Comme vous',
      'expert.notYet': 'Georges n’a pas encore publié ses choix de samedi. Revenez avant la première mise au jeu.',
      'expert.noGames': 'Aucun match ce samedi. Georges sera de retour samedi prochain.',
      'expert.called': 'Bon choix', 'expert.missed': 'Raté',
      'g.live': 'En direct', 'g.postponed': 'Reporté', 'g.final': 'Final', 'g.finalOT': 'Final/Prol.', 'g.finalSO': 'Final/TB', 'g.notFinal': 'Pas terminé', 'g.at': '{a} à {h}',
      'picks.title': 'Vos choix', 'picks.progress': '{n} sur {t} choisis',
      'picks.sub': 'Choisissez le gagnant de chaque match du samedi. La prolongation et les tirs de barrage comptent.',
      'picks.subLock': 'Choisissez le gagnant de chaque match du samedi. Les choix ferment {day} à {time}.',
      'picks.today': 'aujourd’hui', 'picks.onDay': '{day}',
      'picks.lockedMe': 'Vos choix sont verrouillés. Les gagnants s’affichent à la fin de chaque match.',
      'picks.lockedNo': 'Les choix ont fermé à la première mise au jeu. Revenez samedi prochain.',
      'picks.headPick': 'Votre choix', 'picks.headGeorges': 'Georges', 'picks.home': 'Domicile', 'picks.away': 'Visiteur',
      'picks.btnAria': 'Choisir {team}', 'picks.btnShare': ', choisi par {p} % des joueurs', 'picks.georgesPick': 'Choix de Georges',
      'picks.agree': 'Comme Georges sur {a} de {n}', 'picks.noGames': 'Aucun match de la LNH au calendrier ce samedi. Le prochain samedi s’affichera ici automatiquement.',
      'form.username': 'Nom d’utilisateur BetGRW', 'form.usernamePh': 'ex. HabsFan_514', 'form.usernameHelp': 'Votre nom d’utilisateur betgrw.com. Il s’affiche au classement.',
      'form.email': 'Courriel', 'form.emailPh': 'vous@exemple.com', 'form.emailHelp': 'Nous l’utilisons pour vous joindre si vous gagnez. Il n’est jamais affiché sur le site.',
      'form.consent': 'Envoyez-moi un rappel avant chaque samedi ainsi que les nouvelles et les offres de BetGRW. Je peux me désabonner en tout temps.',
      'form.trap': 'Laissez ce champ vide',
      'btn.submit': 'Soumettre mes choix', 'btn.update': 'Mettre à jour', 'btn.saved': 'Choix enregistrés', 'btn.saving': 'Enregistrement', 'btn.locked': 'Choix verrouillés', 'btn.closed': 'Inscriptions fermées',
      'err.username': 'Ajoutez d’abord votre nom d’utilisateur BetGRW : de 3 à 20 lettres, chiffres, points, tirets ou traits de soulignement.',
      'err.email': 'Ajoutez votre courriel pour que nous puissions vous joindre si vous gagnez.',
      'err.save': 'Vos choix n’ont pas été enregistrés. Réessayez.',
      'ok.updated': 'Choix mis à jour.', 'ok.in': 'C’est fait, {name}. Bonne chance contre Georges!',
      'rules.title': 'Comment ça marche',
      'rules.list': [
        'Le concours porte uniquement sur les matchs de la LNH du samedi. Choisissez un gagnant pour chaque match au programme. Les résultats en prolongation et en tirs de barrage comptent.',
        'Les matchs du samedi ouvrent aux choix le mardi, alors vous pouvez faire vos choix n’importe quand pendant la semaine.',
        'Les choix ferment pour tout le monde à la première mise au jeu. D’ici là, vous pouvez les modifier aussi souvent que vous voulez à partir de cet appareil.',
        'Chaque bon choix vaut un point. Les gagnants et les points se mettent à jour automatiquement à la fin des matchs.',
        'Terminez devant Georges et votre nom reçoit la mention « A battu Georges ».',
        'Les matchs reportés ou annulés ne comptent pour personne.',
        'Prix hebdomadaire : les 10 premiers de chaque samedi se partagent 500 $. 1er 150 $, 2e 100 $, 3e 70 $, 4e 50 $, 5e 40 $, 6e 30 $, 7e 22 $, 8e 16 $, 9e 12 $, 10e 10 $.',
        'Prix de la saison : les 20 premiers de la saison 2026-2027 se partagent 5 000 $. 1er 1 500 $, 2e 900 $, 3e 600 $, 4e 400 $, 5e 300 $, 6e 250 $, 7e 200 $, 8e à 10e 125 $ chacun, 11e à 15e 55 $ chacun, 16e à 20e 40 $ chacun.',
        'Vos points de saison sont le total de vos bons choix de chaque samedi, du 14 novembre 2026 au 10 avril 2027. Un samedi manqué compte pour 0. Les prix de la saison sont versés après le dernier samedi.',
        'Votre courriel est obligatoire pour que nous puissions vous joindre si vous gagnez. Il n’est jamais affiché sur le site. Nous vous envoyons des rappels et des offres seulement si vous cochez la case, et vous pouvez vous désabonner en tout temps.',
        'Une inscription par courriel chaque samedi.',
        'Utilisez le même nom d’utilisateur BetGRW chaque semaine, à partir du même appareil. Votre nom d’utilisateur est lié à votre appareil dès votre première inscription, alors personne d’autre ne peut l’utiliser cette saison.',
        'Égalités : les joueurs ayant le même pointage se partagent les prix des positions qu’ils occupent. Par exemple, deux joueurs à égalité au 2e rang se partagent les prix de la 2e et de la 3e place.',
        'Georges apparaît au classement pour le plaisir, mais il n’occupe aucun rang et ne remporte aucun prix.',
        'Si un joueur du top 10 n’est pas admissible, le joueur admissible suivant prend sa place.',
        'Une inscription par personne. Les joueurs qui s’inscrivent plus d’une fois sont disqualifiés, et chaque connexion Internet est limitée à quelques inscriptions par samedi.',
        'Pour être admissible, vous devez avoir déposé au moins 20 $ sur betgrw.com au cours des 30 derniers jours. Inscrivez-vous avec votre nom d’utilisateur betgrw.com pour que nous puissions le vérifier.'
      ],
      'board.title': 'Classement', 'board.aria': 'Choisir un classement', 'board.week': 'Ce samedi', 'board.season': 'Saison',
      'th.player': 'Joueur', 'th.pts': 'Pts', 'th.prize': 'Prix',
      'board.final': '{g} sur {t} terminés', 'board.players1': '{n} joueur', 'board.playersN': '{n} joueurs',
      'board.empty': 'Aucune inscription pour l’instant. Faites vos choix et soyez le premier nom ici.',
      'board.noteNoPrize': 'Les {n} premiers se partagent {pool}. Les prix s’affichent ici dès la fin du premier match.',
      'board.noteFinal': 'Prix finaux. Les joueurs à égalité se partagent les prix des positions qu’ils occupent. Les gagnants doivent être admissibles.',
      'board.noteNow': 'Prix selon le classement actuel. Les joueurs à égalité se partagent les prix des positions qu’ils occupent. Les gagnants doivent être admissibles.',
      'board.showTop': 'Afficher le top 10', 'board.showFull': 'Afficher tout le classement', 'mark.you': 'Vous', 'mark.beat': 'A battu Georges',
      'season.loading': 'Chargement de la saison.', 'season.week': 'Semaine {d} sur {n}', 'season.weeks1': '{n} semaine', 'season.weeksN': '{n} semaines',
      'season.empty': 'Le classement de la saison commence dès la fin du premier match ce samedi.',
      'season.noteFinal': 'Classement final de la saison. Les joueurs à égalité se partagent les prix des positions qu’ils occupent. Les gagnants doivent être admissibles.',
      'season.noteNow': 'Prix de la saison selon le classement actuel, versés après le dernier samedi ({end}). Les joueurs à égalité se partagent les prix des positions qu’ils occupent.',
      'season.showFull': 'Afficher tout le classement de la saison',
      'nhl.title': 'Classement LNH', 'nhl.aria': 'Choisir une vue du classement',
      'nhl.Atlantic': 'Atl.', 'nhl.Metropolitan': 'Métro', 'nhl.Central': 'Cent.', 'nhl.Pacific': 'Pac.', 'nhl.League': 'Ligue',
      'nhl.div.Atlantic': 'Section Atlantique', 'nhl.div.Metropolitan': 'Section Métropolitaine', 'nhl.div.Central': 'Section Centrale', 'nhl.div.Pacific': 'Section Pacifique', 'nhl.all': 'Les 32 équipes',
      'nhl.team': 'Équipe', 'nhl.gp': 'PJ', 'nhl.w': 'V', 'nhl.l': 'D', 'nhl.ot': 'DP', 'nhl.pts': 'PTS',
      'nhl.gpT': 'Parties jouées', 'nhl.wT': 'Victoires', 'nhl.lT': 'Défaites', 'nhl.otT': 'Défaites en prolongation', 'nhl.ptsT': 'Points',
      'nhl.plays': 'Joue ce samedi', 'nhl.line': 'Ligne : les 3 premiers de la section font les séries, plus 2 équipes repêchées par association.',
      'facts.aria': 'Ce samedi en chiffres', 'facts.players': 'joueurs inscrits', 'facts.final': 'matchs terminés', 'facts.ahead': 'devant Georges',
      'feed.title': 'Dernières inscriptions', 'feed.in': 'est inscrit', 'feed.updated': 'a mis à jour ses choix', 'feed.empty': 'Aucune inscription ce samedi pour l’instant.',
      'ago.now': 'maint.', 'ago.m': '{n} min', 'ago.h': '{n} h', 'ago.d': '{n} j',
      'until.min': '{n} min', 'until.h': '{h} h', 'until.hm': '{h} h {m} min', 'until.d1': '1 jour', 'until.dN': '{d} jours', 'until.dh': '{days} {h} h',
      'foot': '18+. Jouez de façon responsable. Résultats des matchs fournis par la LNH. BetGRW n’est pas affilié à la LNH ni à ses équipes.',
      'res.docTitle': 'Saison et résultats | Battez Georges', 'res.skip': 'Aller aux résultats', 'res.title': 'Saison et résultats', 'res.sub': 'Le classement de la saison et chaque samedi terminé',
      'res.back': 'Tous les samedis', 'res.sats': 'Samedis', 'res.satsN1': '{n} samedi', 'res.satsN': '{n} samedis',
      'res.thSat': 'Samedi', 'res.thWinner': 'Gagnant', 'res.thTop': 'Meilleur pointage', 'res.thGeorges': 'Georges', 'res.thBeat': 'Ont battu Georges', 'res.thPlayers': 'Joueurs',
      'res.thWeeks': 'Semaines', 'res.thWins': 'Victoires hebdo.', 'res.thBest': 'Meilleure semaine',
      'res.unavailable': 'Résultats non disponibles pour l’instant', 'res.noEntries': 'Aucune inscription', 'res.inProgress': 'En cours',
      'res.noneYet': 'Aucun samedi terminé pour l’instant. Les résultats s’afficheront ici après le premier samedi.',
      'res.loadFail': 'Les résultats n’ont pas pu être chargés.', 'res.dayFail': 'Ce samedi n’a pas pu être chargé.',
      'res.standings': 'Classement de la {season}', 'res.showTop50': 'Afficher le top 50', 'res.showAllN': 'Afficher les {n} joueurs',
      'res.seasonEmpty': 'Le classement de la saison commence dès la fin du premier match du samedi.',
      'res.seasonFinal': 'Classement final de la saison. Les gagnants doivent être admissibles. Les joueurs à égalité se partagent les prix des positions qu’ils occupent.',
      'res.seasonNow': 'Prix selon le classement actuel. La bourse de la saison de {pool} est versée aux {n} premiers après le dernier samedi ({end}).',
      'res.fSeason': 'Saison', 'res.fSeasonVal': 'du {start} au {end}', 'res.fPlayed': 'Samedis joués', 'res.fPlayedVal': '{d} sur {n}', 'res.fPool': 'Bourse de la saison', 'res.fLeader': 'En tête',
      'res.final': 'Résultats finaux', 'res.partial': 'Résultats partiels. Certains matchs n’étaient pas encore terminés.',
      'res.winner': 'Gagnant', 'res.winners': 'Gagnants', 'res.top': 'Meilleur pointage', 'res.ofN': '{s} sur {n}', 'res.players': 'Joueurs',
      'res.finalStandings': 'Classement final', 'res.finalSub': '{n} joueurs, {b} ont battu Georges', 'res.finalSub1': '{n} joueur, {b} ont battu Georges',
      'res.nobody': 'Personne ne s’est inscrit ce samedi.', 'res.showTop25': 'Afficher le top 25', 'res.prizeNote': 'Les prix vont seulement aux joueurs admissibles. Les joueurs à égalité se partagent les prix des positions qu’ils occupent.',
      'res.games': 'Résultats des matchs', 'res.georgesWent': 'Fiche de Georges : {w}-{l}', 'res.dayTitle': 'Résultats du {date} | Battez Georges',
      'names.and': '{a} et {b}', 'names.more': '{list} et {n} autres',
      'srv': [
        [/^Too many tries\./, 'Trop d’essais. Attendez une minute avant de réessayer.'],
        [/^There are no games on Saturday/, 'Il n’y a aucun match au programme samedi.'],
        [/^Picks locked at the first puck drop\./, 'Les choix ont fermé à la première mise au jeu.'],
        [/^Your picks weren’t saved/, 'Vos choix n’ont pas été enregistrés. Réessayez.'],
        [/^Entries from this internet connection/, 'Les inscriptions provenant de cette connexion Internet ne sont pas acceptées. Communiquez avec le soutien BetGRW si vous croyez qu’il s’agit d’une erreur.'],
        [/^Usernames are 3 to 20/, 'Le nom d’utilisateur doit compter de 3 à 20 lettres, chiffres, points, tirets ou traits de soulignement.'],
        [/^That username is reserved/, 'Ce nom d’utilisateur est réservé. Choisissez-en un autre.'],
        [/^Enter a valid email address/, 'Entrez une adresse courriel valide. Nous l’utilisons pour vous joindre si vous gagnez.'],
        [/^Pick a winner for (\w+) at (\w+)\./, 'Choisissez un gagnant pour $1 à $2.'],
        [/^That email already has an entry/, 'Ce courriel a déjà une inscription ce samedi. C’est une inscription par personne.'],
        [/^That username is taken this Saturday/, 'Ce nom d’utilisateur est déjà pris ce samedi. Choisissez-en un autre.'],
        [/^That username is already used by another player this season/, 'Ce nom d’utilisateur appartient à un autre joueur cette saison. S’il est à vous, inscrivez-vous à partir de l’appareil utilisé la première fois, ou communiquez avec le soutien BetGRW.'],
        [/^This internet connection already has (\d+)/, 'Cette connexion Internet compte déjà $1 inscription(s) ce samedi. C’est une inscription par personne. Pour modifier vos choix, utilisez l’appareil avec lequel vous vous êtes inscrit.'],
        [/couldn’t load/, 'Les matchs n’ont pas pu être chargés. La page réessaiera d’elle-même.']
      ]
    }
  };

  /* ---------- Which language ---------- */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }
  };
  const fromUrl = new URLSearchParams(location.search).get('lang');
  let lang = fromUrl === 'fr' || fromUrl === 'en' ? fromUrl : store.get('bg_lang');
  if (lang !== 'en') lang = 'fr'; // French unless English was chosen
  if (fromUrl === 'fr' || fromUrl === 'en') store.set('bg_lang', lang);
  const fr = lang === 'fr';
  const LOCALE = fr ? 'fr-CA' : 'en-US';

  /* ---------- Text ---------- */
  const t = (key, vars) => {
    let s = S[lang][key];
    if (s === undefined) s = S.en[key];
    if (s === undefined) return key;
    return typeof s === 'string' ? s.replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] !== undefined ? vars[k] : '')) : s;
  };
  // Server messages arrive in English; show them in French when French is on
  const tServer = msg => {
    if (!fr || !msg) return msg;
    for (const [re, out] of S.fr.srv) {
      const m = msg.match(re);
      if (m) return out.replace(/\$(\d)/g, (_, i) => m[i] || '');
    }
    return msg;
  };

  /* ---------- Numbers, money, places, durations ---------- */
  const money = n => {
    const whole = Number.isInteger(n);
    const num = n.toLocaleString(LOCALE, whole ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return fr ? num + ' $' : '$' + num;
  };
  const ordinal = n => fr ? (n === 1 ? '1er' : n + 'e') : n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  const until = ms => {
    const m = Math.max(0, Math.round(ms / 60000));
    if (m < 60) return t('until.min', { n: m });
    const h = Math.floor(m / 60), r = m % 60;
    if (h < 24) return r ? t('until.hm', { h, m: r }) : t('until.h', { h });
    const d = Math.floor(h / 24), rh = h % 24;
    const days = d === 1 ? t('until.d1') : t('until.dN', { d });
    return rh ? t('until.dh', { days, h: rh }) : days;
  };
  const ago = ms => {
    const m = Math.max(0, Math.round((Date.now() - ms) / 60000));
    if (m < 1) return t('ago.now');
    if (m < 60) return t('ago.m', { n: m });
    const h = Math.round(m / 60);
    if (h < 24) return t('ago.h', { n: h });
    return t('ago.d', { n: Math.round(h / 24) });
  };
  const seasonName = (start, end) => t('season.name', { y1: start.slice(0, 4), y2: end.slice(0, 4), y2s: end.slice(2, 4) });
  const names = list => list.length === 1 ? list[0] : list.length === 2 ? t('names.and', { a: list[0], b: list[1] }) : t('names.more', { list: list.slice(0, 2).join(', '), n: list.length - 2 });
  // Team names: "Montréal Canadiens" in English, "Canadiens de Montréal" in French
  const FR_NAMES = { OTT: 'Sénateurs' };
  const teamName = i => fr ? `${FR_NAMES[i.abbr] || i.name} ${/^[AEIOUÉ]/i.test(i.city) ? 'd’' : 'de '}${i.city}` : `${i.city} ${i.name}`;
  const shortTeam = i => fr ? (FR_NAMES[i.abbr] || i.name) : i.name;

  /* ---------- Fill in the static page text ---------- */
  function apply(root) {
    document.documentElement.lang = lang;
    (root || document).querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    (root || document).querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
    (root || document).querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    (root || document).querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    (root || document).querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
    (root || document).querySelectorAll('[data-i18n-list]').forEach(el => {
      el.innerHTML = t(el.dataset.i18nList).map(item => `<li>${item.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</li>`).join('');
    });
    const sw = document.getElementById('lang-switch');
    if (sw) {
      sw.textContent = fr ? 'EN' : 'FR';
      sw.setAttribute('aria-label', t('lang.switchAria'));
      sw.setAttribute('lang', fr ? 'en' : 'fr');
      sw.href = '?lang=' + (fr ? 'en' : 'fr') + location.hash;
      sw.addEventListener('click', e => {
        e.preventDefault();
        store.set('bg_lang', fr ? 'en' : 'fr');
        const u = new URL(location.href);
        u.searchParams.set('lang', fr ? 'en' : 'fr');
        location.href = u.toString();
      });
    }
  }

  window.I18N = { lang, fr, LOCALE, t, tServer, money, ordinal, until, ago, seasonName, names, teamName, shortTeam, apply };
  apply();
})();
