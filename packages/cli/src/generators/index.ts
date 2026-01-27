/**
 * Generator Registry
 * Auto-register all adapter generators via side-effect imports
 */

// These imports execute the registerAdapterGenerator() calls in each file
import './capabilities/account.generator'
import './capabilities/ai.generator'
import './capabilities/analytics.generator'
import './capabilities/auth.generator'
import './capabilities/cache.generator'
import './capabilities/events.generator'
import './capabilities/flags.generator'
import './capabilities/explorer.generator'
import './capabilities/http.generator'
import './capabilities/indexer.generator'
import './capabilities/jobs.generator'
import './capabilities/notifications.generator'
import './capabilities/observability.generator'
import './capabilities/orm.generator'
import './capabilities/payments.generator'
import './capabilities/rpc.generator'
import './capabilities/search.generator'
import './capabilities/storage.generator'
import './capabilities/wallet.generator'
