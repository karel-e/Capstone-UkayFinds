<?php
/**
 * api/lib/mail_templates.php
 *
 * One shared layout + nine message types, so every email from UkayFinds
 * looks and sounds the same: formal, short, and clearly from us.
 *
 *   $m = mail_build('otp_signup', ['name' => 'Karel', 'code' => '482913', 'minutes' => 10]);
 *   // $m['subject'], $m['html'], $m['text']   (send both html and text)
 *
 * Types and the values each one reads (all optional unless marked *):
 *   otp_signup              code*, minutes, name
 *   password_reset          reset_url*, minutes, name
 *   account_deactivated     name, signin_url
 *   account_deletion_request confirm_url*, minutes, name
 *   account_deleted         name, date
 *   stall_received          stall_name*, address, name
 *   stall_verified          stall_name*, address, name, stall_url
 *   stall_declined          stall_name*, reason, name
 *   notice                  subject*, title*, paragraphs* (array of text), button_label, button_url, name
 *
 * Everything is escaped here, so pass plain text, never HTML.
 * Set these in api/config.local.php (or edit the defaults below):
 *   SITE_URL        e.g. 'https://yourdomain.com/ukayfinds'  (no trailing slash)
 *   SUPPORT_EMAIL   e.g. 'ukayfinds.ph@gmail.com'
 */

if (!function_exists('mail_e')) {
    function mail_e($s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
}

/** Only http(s) links are allowed in emails; anything else becomes '#'. */
function mail_safe_url($u): string {
    $u = trim((string)$u);
    return preg_match('#^https?://#i', $u) ? $u : '#';
}

function mail_brand(): array {
    $site = defined('SITE_URL') ? rtrim(SITE_URL, '/') : 'http://localhost/ukayfinds';
    return [
        'site'    => $site,
        'support' => defined('SUPPORT_EMAIL') ? SUPPORT_EMAIL : 'ukayfinds.cebu.ph@gmail.com',
        'terms'   => $site . '/landing.html#terms',
        'privacy' => $site . '/landing.html#privacy',
        'year'    => date('Y'),
    ];
}

/** Turns one message definition into the finished HTML email. */
function mail_layout(array $d, array $b): string {
    $f = "font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;";
    $ink = '#2A2620'; $red = '#C3291D'; $yellow = '#F5B91A'; $cream = '#F9F1E1'; $paper = '#FFFCF5'; $tan = '#F0E2C0'; $muted = '#6b6358';

    $h = '';
    foreach ($d['paragraphs'] as $p) {
        $h .= '<p style="margin:0 0 16px;' . $f . 'font-size:15px;line-height:1.65;color:#4a443a;">' . mail_e($p) . '</p>';
    }

    $code = '';
    if (!empty($d['code'])) {
        $spaced = implode('&nbsp;', array_map('mail_e', str_split((string)$d['code'])));
        $code = '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:8px auto 20px;">'
              . '<tr><td align="center" style="background:' . $tan . ';border:1.5px solid ' . $ink . ';border-radius:14px;padding:16px 30px;'
              . $f . 'font-size:32px;font-weight:700;letter-spacing:6px;color:' . $ink . ';">' . $spaced . '</td></tr></table>';
    }

    $details = '';
    if (!empty($d['details'])) {
        $details = '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 20px;border:1px solid #D9C79A;border-radius:12px;">';
        $last = array_key_last($d['details']);
        foreach ($d['details'] as $label => $value) {
            $line = ($label === $last) ? 'none' : '1px solid #E6D8B4';
            $details .= '<tr><td style="padding:10px 14px;border-bottom:' . $line . ';' . $f . 'font-size:13px;color:' . $muted . ';width:34%;">' . mail_e($label)
                      . '</td><td style="padding:10px 14px;border-bottom:' . $line . ';' . $f . 'font-size:14px;font-weight:700;color:' . $ink . ';">' . mail_e($value) . '</td></tr>';
        }
        $details .= '</table>';
    }

    $button = '';
    if (!empty($d['button'])) {
        [$label, $url] = $d['button'];
        $url = mail_safe_url($url);
        $button = '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:8px auto 22px;"><tr>'
                . '<td align="center" style="background:' . $yellow . ';border:1.5px solid ' . $ink . ';border-radius:999px;">'
                . '<a href="' . mail_e($url) . '" target="_blank" style="display:inline-block;padding:13px 30px;' . $f . 'font-size:15px;font-weight:700;color:' . $ink . ';text-decoration:none;">'
                . mail_e($label) . '</a></td></tr></table>'
                . '<p style="margin:0 0 18px;' . $f . 'font-size:12px;line-height:1.5;color:' . $muted . ';text-align:center;">If the button does not work, copy this link into your browser:<br>'
                . '<a href="' . mail_e($url) . '" style="color:' . $red . ';word-break:break-all;">' . mail_e($url) . '</a></p>';
    }

    $note = '';
    if (!empty($d['note'])) {
        $note = '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:6px 0 20px;"><tr>'
              . '<td style="background:' . $cream . ';border-left:4px solid ' . $red . ';border-radius:8px;padding:12px 14px;' . $f . 'font-size:13px;line-height:1.55;color:' . $ink . ';">'
              . mail_e($d['note']) . '</td></tr></table>';
    }

    return '<!doctype html><html lang="en"><head><meta charset="utf-8">'
      . '<meta name="viewport" content="width=device-width,initial-scale=1">'
      . '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">'
      . '<title>' . mail_e($d['subject']) . '</title></head>'
      . '<body style="margin:0;padding:0;background:' . $cream . ';">'
      . '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">' . mail_e($d['preheader']) . '</div>'
      . '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:' . $cream . ';"><tr><td align="center" style="padding:28px 12px;">'
      .   '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:' . $paper . ';border:1.5px solid ' . $ink . ';border-radius:18px;">'
      .     '<tr><td style="padding:24px 32px 18px;border-bottom:4px solid ' . $yellow . ';">'
      .       '<span style="' . $f . 'font-size:24px;font-weight:900;color:' . $ink . ';">Ukay<span style="color:' . $red . ';">Finds</span></span>'
      .       '<div style="' . $f . 'font-size:12px;letter-spacing:1px;text-transform:uppercase;color:' . $muted . ';margin-top:2px;">Cebu ukay-ukay directory &amp; community</div>'
      .     '</td></tr>'
      .     '<tr><td style="padding:28px 32px 8px;">'
      .       '<h1 style="margin:0 0 16px;' . $f . 'font-size:22px;line-height:1.25;color:' . $ink . ';">' . mail_e($d['title']) . '</h1>'
      .       '<p style="margin:0 0 16px;' . $f . 'font-size:15px;line-height:1.65;color:#4a443a;">' . mail_e($d['greeting']) . '</p>'
      .       $h . $code . $details . $button . $note
      .       '<p style="margin:0 0 4px;' . $f . 'font-size:15px;line-height:1.65;color:#4a443a;">Kind regards,</p>'
      .       '<p style="margin:0 0 24px;' . $f . 'font-size:15px;font-weight:700;color:' . $ink . ';">The UkayFinds Team</p>'
      .     '</td></tr>'
      .     '<tr><td style="padding:18px 32px 24px;background:' . $cream . ';border-top:1px solid #D9C79A;border-radius:0 0 16px 16px;">'
      .       '<p style="margin:0 0 10px;' . $f . 'font-size:12px;line-height:1.55;color:' . $muted . ';">' . mail_e($d['reason']) . '</p>'
      .       '<p style="margin:0 0 10px;' . $f . 'font-size:12px;line-height:1.55;color:' . $muted . ';">Questions? Write to us at <a href="mailto:' . mail_e($b['support']) . '" style="color:' . $red . ';">' . mail_e($b['support']) . '</a>. '
      .         'UkayFinds will never ask for your password by email.</p>'
      .       '<p style="margin:0;' . $f . 'font-size:12px;line-height:1.55;color:' . $muted . ';">'
      .         '<a href="' . mail_e($b['terms']) . '" style="color:' . $muted . ';">Terms of Service</a> &middot; '
      .         '<a href="' . mail_e($b['privacy']) . '" style="color:' . $muted . ';">Privacy Policy</a> &middot; &copy; ' . mail_e($b['year']) . ' UkayFinds, Cebu, Philippines</p>'
      .     '</td></tr>'
      .   '</table>'
      . '</td></tr></table></body></html>';
}

/** Plain-text twin of the same message (some mail apps show only this). */
function mail_text(array $d, array $b): string {
    $t = $d['title'] . "\n\n" . $d['greeting'] . "\n\n";
    foreach ($d['paragraphs'] as $p) $t .= $p . "\n\n";
    if (!empty($d['code'])) $t .= "    " . $d['code'] . "\n\n";
    if (!empty($d['details'])) { foreach ($d['details'] as $k => $v) $t .= $k . ': ' . $v . "\n"; $t .= "\n"; }
    if (!empty($d['button'])) $t .= $d['button'][0] . ': ' . mail_safe_url($d['button'][1]) . "\n\n";
    if (!empty($d['note'])) $t .= $d['note'] . "\n\n";
    $t .= "Kind regards,\nThe UkayFinds Team\n\n--\n" . $d['reason'] . "\nQuestions? " . $b['support']
        . "\nUkayFinds will never ask for your password by email.\nTerms: " . $b['terms'] . "\nPrivacy: " . $b['privacy'] . "\n";
    return $t;
}

/** Builds ['subject' => ..., 'html' => ..., 'text' => ...] for one message type. */
function mail_build(string $type, array $v = []): array {
    $b = mail_brand();
    $name = trim((string)($v['name'] ?? ''));
    $greeting = $name !== '' ? 'Dear ' . $name . ',' : 'Hello,';
    $mins = (int)($v['minutes'] ?? 10);
    $stall = (string)($v['stall_name'] ?? '');
    $stallDetails = ['Stall' => $stall];
    if (!empty($v['address'])) $stallDetails['Location'] = (string)$v['address'];

    switch ($type) {
        case 'otp_signup':
            $d = [
                'subject' => 'Your UkayFinds verification code',
                'preheader' => 'Use this code to finish creating your account.',
                'title' => 'Verify your email address',
                'paragraphs' => ['Thank you for registering with UkayFinds. To complete your registration, please enter the verification code below.'],
                'code' => (string)($v['code'] ?? ''),
                'note' => 'This code is valid for ' . $mins . ' minutes and can be used once. For your security, do not share it with anyone. UkayFinds staff will never ask for it.',
                'reason' => 'You received this email because this address was used to create a UkayFinds account. If this was not you, you can safely ignore this message and no account will be created.',
            ]; break;

        case 'password_reset':
            $d = [
                'subject' => 'Reset your UkayFinds password',
                'preheader' => 'We received a request to reset your password.',
                'title' => 'Reset your password',
                'paragraphs' => ['We received a request to reset the password for your UkayFinds account. Select the button below to choose a new one. The link is valid for ' . $mins . ' minutes and can be used once.'],
                'button' => ['Reset password', (string)($v['reset_url'] ?? '')],
                'note' => 'If you did not request this, no action is needed. Your password will stay the same.',
                'reason' => 'You received this email because a password reset was requested for this address.',
            ]; break;

        case 'account_deactivated':
            $d = [
                'subject' => 'Your UkayFinds account has been deactivated',
                'preheader' => 'Your account is now hidden. You can reactivate it anytime.',
                'title' => 'Your account has been deactivated',
                'paragraphs' => [
                    'This is to confirm that your UkayFinds account has been deactivated. Your profile and posts are no longer visible to other members.',
                    'Nothing has been deleted. You may reactivate your account at any time by signing in again.',
                ],
                'button' => ['Sign in to reactivate', (string)($v['signin_url'] ?? ($b['site'] . '/landing.html'))],
                'note' => 'If you did not request this change, please contact us right away at ' . $b['support'] . '.',
                'reason' => 'You received this email because of a change to your UkayFinds account.',
            ]; break;

        case 'account_deletion_request':
            $d = [
                'subject' => 'Confirm deletion of your UkayFinds account',
                'preheader' => 'Please confirm before we delete your account.',
                'title' => 'Confirm account deletion',
                'paragraphs' => [
                    'We received a request to permanently delete your UkayFinds account. Deleting it removes your profile, hauls and photos, comments, ratings, saved items, and Ukay Trail stamps and rewards.',
                    'This cannot be undone. To go ahead, select the button below within ' . $mins . ' minutes.',
                ],
                'button' => ['Permanently delete my account', (string)($v['confirm_url'] ?? '')],
                'note' => 'If you did not request this, do not click the button. Your account stays active. We also recommend changing your password.',
                'reason' => 'You received this email because deletion of this account was requested.',
            ]; break;

        case 'account_deleted':
            $d = [
                'subject' => 'Your UkayFinds account has been deleted',
                'preheader' => 'This confirms your account and its data were removed.',
                'title' => 'Your account has been deleted',
                'paragraphs' => [
                    'This confirms that your UkayFinds account and the data linked to it were deleted' . (!empty($v['date']) ? ' on ' . $v['date'] : '') . '.',
                    'Thank you for being part of the community. You are welcome to create a new account whenever you like.',
                ],
                'reason' => 'This is a one-time confirmation. We will not send you further emails.',
            ]; break;

        case 'stall_received':
            $d = [
                'subject' => 'We received your stall suggestion',
                'preheader' => $stall . ' is on the map and awaiting verification.',
                'title' => 'Thank you for suggesting a stall',
                'paragraphs' => [
                    'We have received your suggestion. The stall is now visible on the map marked "Unverified" while an administrator checks the details.',
                    'You will receive another email once the review is complete.',
                ],
                'details' => $stallDetails + ['Status' => 'Unverified, under review'],
                'reason' => 'You received this email because you submitted a stall on UkayFinds.',
            ]; break;

        case 'stall_verified':
            $d = [
                'subject' => 'Your stall is now verified on UkayFinds',
                'preheader' => $stall . ' now carries the Verified badge.',
                'title' => 'Your stall has been verified',
                'paragraphs' => [
                    'Good news. An administrator has reviewed your suggestion and the stall now carries the Verified badge. Thank you for helping thrifters in Cebu find it.',
                ],
                'details' => $stallDetails + ['Status' => 'Verified'],
                'button' => !empty($v['stall_url']) ? ['View the stall', (string)$v['stall_url']] : null,
                'reason' => 'You received this email because you submitted this stall on UkayFinds.',
            ]; if ($d['button'] === null) unset($d['button']); break;

        case 'stall_declined':
            $d = [
                'subject' => 'Update on your stall suggestion',
                'preheader' => 'We could not verify ' . $stall . ' at this time.',
                'title' => 'Update on your stall suggestion',
                'paragraphs' => array_values(array_filter([
                    'Thank you for your suggestion. After review, we were unable to verify this stall, so it has been removed from the map.',
                    !empty($v['reason']) ? 'Reason: ' . $v['reason'] : null,
                    'If you believe this was a mistake, you are welcome to submit the stall again with a corrected pin and details, or reply to this email.',
                ])),
                'details' => $stallDetails + ['Status' => 'Not verified'],
                'reason' => 'You received this email because you submitted this stall on UkayFinds.',
            ]; break;

        case 'notice':
            $d = [
                'subject' => (string)($v['subject'] ?? 'A notice from UkayFinds'),
                'preheader' => (string)($v['preheader'] ?? ($v['title'] ?? '')),
                'title' => (string)($v['title'] ?? 'A notice from UkayFinds'),
                'paragraphs' => array_map('strval', $v['paragraphs'] ?? []),
                'reason' => 'You received this service message because you have a UkayFinds account.',
            ];
            if (!empty($v['button_label']) && !empty($v['button_url'])) $d['button'] = [(string)$v['button_label'], (string)$v['button_url']];
            break;

        default:
            throw new InvalidArgumentException('Unknown email type: ' . $type);
    }

    $d += ['greeting' => $greeting];
    return ['subject' => $d['subject'], 'html' => mail_layout($d, $b), 'text' => mail_text($d, $b)];
}