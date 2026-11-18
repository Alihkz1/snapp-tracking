# Snapp Tracking — Rides & Food Reports

A personal reporting dashboard for Snapp Taxi rides and SnappFood orders. Retrieve your history, group spending by Persian year and city, and review totals in a responsive Persian interface.

**[Explore the source →](https://github.com/Alihkz1/snapp-tracking)**

## Experience

Switch between **Snapp Taxi** and **SnappFood**, enter the corresponding access token, and generate a report. Summary cards show the number of included rides or orders, total spending in toman, and the number of cities. A detailed table breaks down the results by year and city, with vehicle categories included for taxi rides.

The interface uses right-to-left text, Persian numerals, rounded surfaces, and separate green and coral themes for the two services.

## Features

- **Two reporting modes:** separate workflows and saved tokens for Snapp Taxi and SnappFood.
- **Spending summaries:** total cost, included record count, and distinct city count.
- **Persian-calendar grouping:** dates are converted to Persian years using `Intl.DateTimeFormat`.
- **Taxi breakdowns:** aggregates rides by year, city, and vehicle category.
- **Food breakdowns:** aggregates eligible orders by year and city, excluding canceled orders and entries without a start date.
- **Sequential pagination:** retrieves history pages one at a time, with progress messages during processing.
- **Clear loading and error states:** disables report submission and service switching while a report is running.
- **Local proxy:** a small Node.js server forwards authenticated history requests and serves the interface.
- **No package installation:** uses browser APIs and Node.js built-in modules, with no application database or build step.

## Built with

| Technology | Purpose |
| --- | --- |
| HTML5 | Persian dashboard and report table |
| CSS3 | Responsive layout, themes, and loading indicator |
| Vanilla JavaScript | History retrieval, aggregation, and rendering |
| Node.js | Local HTTP server and provider proxy |
| Browser localStorage | Separate saved access tokens for each service |
| Intl API | Persian calendar and number formatting |
| Vazirmatn | Persian typography, loaded through Google Fonts |

## Run locally

Use Node.js 18 or newer; the server relies on the built-in `fetch` API.

```bash
git clone https://github.com/Alihkz1/snapp-tracking.git
cd snapp-tracking
node snapp-server.js
```

Open **[127.0.0.1:8765](http://127.0.0.1:8765)** in your browser.

There is no `package.json`, dependency installation, or compilation step. The server binds to `127.0.0.1` on port `8765`.

Opening `snapp.html` directly is also supported, but the Node.js server must still be running: the page forwards its API requests to the local proxy. Using the server URL keeps the interface and requests on the same origin.

## Generate a report

1. Choose **Snapp Taxi** or **SnappFood**.
2. Enter a valid access token for your own account and the selected service. An optional `Bearer` prefix is removed automatically.
3. Select **محاسبه گزارش** to start retrieving history.
4. Wait for pagination and aggregation to finish.
5. Review the summary cards and grouped table.

The selected service's token is restored on subsequent visits. Switching services loads that service's saved token and hides the previous report. Expired or rejected tokens produce an error; the application does not provide login, OTP, or token renewal.

## Project structure

```text
snapp-tracking/
├── snapp.html        # Dashboard markup and inline styles
├── snapp.js          # Tokens, pagination, aggregation, and UI behavior
├── snapp-server.js   # Local static server and authenticated proxy
└── README.md
```

## How reporting works

The browser calls the local proxy with an `Authorization: Bearer …` header. The server forwards that header to the selected provider, and the browser calculates the report from the returned history.

| Local route | Purpose |
| --- | --- |
| `/` or `/snapp.html` | Serve the dashboard |
| `/snapp.js` | Serve the browser script |
| `/snapp-api` | Forward taxi history requests |
| `/snappfood-api` | Forward food-order history requests |

### Taxi history

The client starts with page `1` and archive `0`, then follows the response's `required_params` for subsequent pages. It tracks visited page parameters to detect pagination loops. Included ride prices are converted from rial to toman by dividing by `10`, then grouped by Persian year, inferred city, and vehicle category.

### Food history

The client starts with page `0` and requests `20` orders per page. Canceled orders, entries without `startedAt`, and non-finite prices are excluded. `totalPrice` is treated as toman by the current implementation. Pagination stops according to the returned count, page size, or an empty page.

Both workflows wait `120 ms` between successive pages. Reports are shown once the complete retrieval succeeds; a failed request displays an error rather than a partial result.

## Data & privacy

Access tokens are saved in this browser's localStorage under:

```text
snapp-report.token.taxi
snapp-report.token.food
```

The server forwards tokens to the selected provider and does not write tokens or history to a database or file. Reports remain in page memory and are recalculated when requested. Clearing the site's browser storage removes saved tokens; there is no dedicated delete-token button.

The application is an independent personal reporting tool and is not an official Snapp or SnappFood product. It depends on provider endpoints and response formats used in the source, which may change. City detection uses address parsing and coordinate heuristics, so inferred cities may be inaccurate.

## Customize

| Change | File |
| --- | --- |
| Page structure, typography, colors, and mobile layout | `snapp.html` |
| Service labels, table columns, and number formatting | `snapp.js` |
| Grouping rules, city inference, and pagination | `snapp.js` |
| Taxi device fingerprint | `DEVICE_FINGERPRINT` in `snapp.js` |
| Local host, port, upstream URLs, and request headers | `snapp-server.js` |

The taxi proxy reads the configured device fingerprint from `snapp.js` when forwarding requests. If the local port changes, also update the `file:` fallback URL in `getProxyUrl()` in `snapp.js`.

## Hosting

The current application is designed for local use. Static hosting alone cannot run its Node.js proxy, and the supplied server binds only to the local machine. No hosted deployment configuration is included.

The current proxy permits cross-origin requests and has no application login or access-control layer. Public hosting requires an explicit deployment and security review rather than exposing the local server unchanged.

## Author

**Ali Hosseinkhani**

- [GitHub — alihkz1](https://github.com/alihkz1)
- [LinkedIn — alihkz](https://www.linkedin.com/in/alihkz/)
- [Instagram — alihkz](https://www.instagram.com/alihkz/)
- [Telegram — alihkz](https://t.me/alihkz)
