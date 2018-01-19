angular.module("App").controller(
    "HostingDatabasePrivateActiveCtrl",
    class HostingDatabasePrivateActiveCtrl {

        constructor ($scope, $rootScope, $stateParams, HostingDatabase, Alerter, PrivateDatabase) {
            this.$scope = $scope;
            this.$rootScope = $rootScope;
            this.$stateParams = $stateParams;
            this.HostingDatabase = HostingDatabase;
            this.Alerter = Alerter;
            this.PrivateDatabase = PrivateDatabase;

            this.host = this.$scope.currentActionData;
            this.versions = [];
            this.loaders = {
                versions: false
            };
            this.choice = {
                ram: this.host.offerCapabilities.privateDatabases.length === 1 ?
                       _.first(this.host.offerCapabilities.privateDatabases) : null,
                version: null
            };

            this.$scope.activateDatabase = () => this.activateDatabase();
        }

        $onInit () {
            if (!this.loaders.versions) {
                this.loaders.versions = true;
                this.PrivateDatabase.getAvailableOrderCapacities("classic")
                    .then((capacities) => {
                        this.versions = _.get(capacities, "version");
                        this.choice.version = this.versions.length === 1 ? _.first(this.versions) : null;
                    })
                    .catch((err) => {
                        this.Alerter.alertFromSWS(this.$scope.tr("hosting_dashboard_database_versions_error",
                                                                 [this.$scope.entryToDelete]),
                                                  _.get(err, "data", err),
                                                  this.$scope.alerts.main);
                    })
                    .finally(() => {
                        this.loaders.versions = false;
                    });
            }
        }

        activateDatabase () {
            if (this.loaders.versions) {
                return;
            }

            this.loaders.versions = true;
            this.HostingDatabase.activateDatabasePrivate(this.$stateParams.productId,
                                                         this.choice.ram.quota.value,
                                                         this.choice.version)
                .then(() => {
                    this.$rootScope.$broadcast("hosting.database.sqlPrive");
                    this.Alerter.success(this.$scope.tr("hosting_dashboard_database_active_success"),
                                         this.$scope.alerts.main);
                })
                .catch((err) => {
                    this.Alerter.alertFromSWS(this.$scope.tr("hosting_dashboard_database_active_error",
                                                             [this.$scope.entryToDelete]),
                                              _.get(err, "data", err),
                                              this.$scope.alerts.main);
                })
                .finally(() => {
                    this.$scope.resetAction();
                });
        }
});
