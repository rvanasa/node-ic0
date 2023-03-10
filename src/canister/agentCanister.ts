import { Canister } from '../types';
import { IDL } from '@dfinity/candid';
import { Actor, ActorSubclass, HttpAgent, fetchCandid } from '@dfinity/agent';

class AgentCanister implements Canister {
    public readonly agent: HttpAgent;
    public readonly id: string;

    private _actor: ActorSubclass | undefined;

    constructor(agent: HttpAgent, id: string) {
        this.agent = agent;
        this.id = id;
    }

    private async _fetchActor() {
        if (this._actor) {
            return this._actor;
        }
        const source = await fetchCandid(this.id, this.agent);
        const didJsCanisterId = this.agent.isLocal()
            ? 'ryjl3-tyaaa-aaaaa-aaaba-cai'
            : 'a4gq6-oaaaa-aaaab-qaa4q-cai';
        const didJsInterface: IDL.InterfaceFactory = ({ IDL }) =>
            IDL.Service({
                did_to_js: IDL.Func([IDL.Text], [IDL.Opt(IDL.Text)], ['query']),
            });
        const didJs: ActorSubclass = Actor.createActor(didJsInterface, {
            canisterId: didJsCanisterId,
            agent: this.agent,
        });
        const js = ((await didJs.did_to_js(source)) as [string])[0];
        const candid = await eval(
            `import("data:text/javascript;charset=utf-8,${encodeURIComponent(
                js,
            )}")`,
        );
        const actor = Actor.createActor(candid.idlFactory, {
            agent: this.agent,
            canisterId: this.id,
        });
        this._actor = actor;
        return actor;
    }

    async call(method: string, ...args: any[]): Promise<any> {
        const actor = await this._fetchActor();
        const result = await actor[method](...args);

        return result;

        // // Convert to JSON-like object
        // return JSON.parse(
        //     JSON.stringify(result, (_key, value) => {
        //         if (typeof value === 'bigint') {
        //             return value.toString();
        //         }
        //         // TODO: Principal, Blob, etc.
        //         return value;
        //     }),
        // );
    }
}

export function agentCanister(agent: HttpAgent, id: string): AgentCanister {
    return new AgentCanister(agent, id);
}
